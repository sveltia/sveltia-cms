import { IndexedDB } from '@sveltia/utils/storage';
import { allAssets, getAssetFoldersByPath } from '$lib/services/assets';
import { parseAssetFiles } from '$lib/services/assets/parser';
import { gitConfigFiles, isLastCommitPublished } from '$lib/services/backends';
import {
  allEntries,
  dataLoaded,
  entryParseErrors,
  getEntryFoldersByPath,
} from '$lib/services/contents';
import { isIndexFile, prepareEntries } from '$lib/services/contents/file/process';

/**
 * @import {
 * BaseAssetListItem,
 * BaseConfigListItem,
 * BaseEntryListItem,
 * BaseFileListItem,
 * BaseFileListItemProps,
 * RepositoryContentsMap,
 * RepositoryInfo,
 * } from '$lib/types/private';
 */

/**
 * Regular expression to match Git configuration files.
 * @type {RegExp}
 */
const gitConfigFileRegex = /^(?:.+\/)?(\.git(?:attributes|ignore|keep))$/;

/**
 * @typedef {object} BaseFileList
 * @property {BaseEntryListItem[]} entryFiles Entry file list.
 * @property {BaseAssetListItem[]} assetFiles Asset file list.
 * @property {BaseConfigListItem[]} configFiles Config file list.
 * @property {BaseFileListItem[]} allFiles All the file list combined.
 * @property {number} count Number of `allFiles`.
 */

/** @type {RepositoryInfo} */
export const repositoryProps = {
  service: '',
  label: '',
  owner: '',
  repo: '',
  branch: '',
};

/**
 * Parse a list of all files on the repository/filesystem to create entry and asset lists, with the
 * relevant collection/file configuration added.
 * @param {BaseFileListItemProps[]} files Unfiltered file list.
 * @returns {BaseFileList} File list, including both entries and assets.
 */
export const createFileList = (files) => {
  /** @type {BaseEntryListItem[]} */
  const entryFiles = [];
  /** @type {BaseAssetListItem[]} */
  const assetFiles = [];
  /** @type {BaseConfigListItem[]} */
  const configFiles = [];

  files.forEach((fileInfo) => {
    const { path } = fileInfo;
    const [entryFolder] = getEntryFoldersByPath(path);
    const [assetFolder] = getAssetFoldersByPath(path, { matchSubFolders: true });

    if (entryFolder) {
      entryFiles.push({ ...fileInfo, type: 'entry', folder: entryFolder });
    }

    // Exclude files already listed as entries. These files can appear in the file list when a
    // relative media path is configured for a collection. Also exclude Hugo’s special index files.
    if (assetFolder && !entryFiles.find((e) => e.path === path) && !isIndexFile(path)) {
      assetFiles.push({ ...fileInfo, type: 'asset', folder: assetFolder });
    }

    // Include extra files that we need to keep track of, such as `.gitattributes` and `.gitkeep`.
    // We need these files for some features, such as Git LFS tracking and assets folder navigation.
    if (gitConfigFileRegex.test(path)) {
      configFiles.push({ ...fileInfo, type: 'config' });
    }
  });

  const allFiles = [...entryFiles, ...assetFiles, ...configFiles];

  return { entryFiles, assetFiles, configFiles, allFiles, count: allFiles.length };
};

/**
 * Fetch file list from a backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 * @param {object} args Arguments.
 * @param {RepositoryInfo} args.repository Repository info.
 * @param {() => Promise<string>} args.fetchDefaultBranchName Function to fetch the repository’s
 * default branch name.
 * @param {() => Promise<{ hash: string, message: string }>} args.fetchLastCommit Function to fetch
 * the last commit’s SHA-1 hash and message.
 * @param {(lastHash: string) => Promise<BaseFileListItemProps[]>} args.fetchFileList Function to
 * fetch the repository’s complete file list.
 * @param {(fetchingFiles: BaseFileListItem[]) => Promise<RepositoryContentsMap>
 * } args.fetchFileContents Function to fetch the metadata of entry/asset files as well as text file
 * contents.
 */
export const fetchAndParseFiles = async ({
  repository,
  fetchDefaultBranchName,
  fetchLastCommit,
  fetchFileList,
  fetchFileContents,
}) => {
  const { databaseName, branch: branchName } = repository;
  const metaDB = new IndexedDB(/** @type {string} */ (databaseName), 'meta');
  const cacheDB = new IndexedDB(/** @type {string} */ (databaseName), 'file-cache');
  const cachedHash = await metaDB.get('last_commit_hash');
  const gitConfigFetched = await metaDB.get('git_config_fetched');
  const cachedFileEntries = await cacheDB.entries();
  let branch = branchName;
  /** @type {BaseFileList | undefined} */
  let fileList;

  if (!branch) {
    branch = await fetchDefaultBranchName();
    repository.branch = branch;
  }

  // This has to be done after the branch is determined
  const { hash: lastHash, message } = await fetchLastCommit();

  if (cachedHash && cachedHash === lastHash && gitConfigFetched && cachedFileEntries.length) {
    // Skip fetching the file list if the cached hash matches the latest. But don’t skip if the file
    // cache is empty; something probably went wrong the last time the files were fetched.
    fileList = createFileList(cachedFileEntries.map(([path, data]) => ({ path, ...data })));
  } else {
    // Get a complete file list first, and filter what’s managed in CMS
    fileList = createFileList(await fetchFileList(lastHash));
    metaDB.set('last_commit_hash', lastHash);
    metaDB.set('git_config_fetched', true);
  }

  // @todo Check if the commit has a workflow run that trigged deployment
  isLastCommitPublished.set(!message.startsWith('[skip ci]'));

  // Skip fetching files if no files found
  if (!fileList.count) {
    allEntries.set([]);
    allAssets.set([]);
    gitConfigFiles.set([]);
    dataLoaded.set(true);

    return;
  }

  const { entryFiles, assetFiles, configFiles, allFiles } = fileList;
  const cachedFiles = Object.fromEntries(cachedFileEntries);

  // Restore cached text and commit info
  allFiles.forEach(({ sha, path }, index) => {
    if (cachedFiles[path]?.sha === sha) {
      Object.assign(allFiles[index], cachedFiles[path]);
    }
  });

  const fetchingFiles = allFiles.filter(({ meta }) => !meta);
  const fetchedFileMap = fetchingFiles.length ? await fetchFileContents(fetchingFiles) : {};

  /**
   * Parse a file and add additional metadata, such as name, size, and text content.
   * @param {BaseFileListItem} file File to parse.
   * @returns {BaseFileListItem} Parsed file with additional metadata.
   */
  const parseFile = (file) => {
    const { meta, text, size } = fetchedFileMap[file.path] ?? {};

    return {
      ...file,
      name: file.path.split('/').pop(),
      meta: file.meta ?? meta,
      // The size and text are only available in the 2nd request (`fetchFileContents`) on GitLab
      size: file.size ?? size,
      text: file.text ?? text,
    };
  };

  const { entries, errors } = await prepareEntries(
    /** @type {BaseEntryListItem[]} */ (entryFiles.map(parseFile)),
  );

  allEntries.set(entries);
  allAssets.set(parseAssetFiles(/** @type {BaseAssetListItem[]} */ (assetFiles.map(parseFile))));
  gitConfigFiles.set(/** @type {BaseConfigListItem[]} */ (configFiles.map(parseFile)));
  entryParseErrors.set(errors);
  dataLoaded.set(true);

  const usedPaths = allFiles.map(({ path }) => path);
  const unusedPaths = Object.keys(cachedFiles).filter((path) => !usedPaths.includes(path));

  // Save new entry caches
  if (fetchingFiles.length) {
    await cacheDB.saveEntries(Object.entries(fetchedFileMap));
  }

  // Delete old entry caches
  if (unusedPaths.length) {
    cacheDB.deleteEntries(unusedPaths);
  }
};
