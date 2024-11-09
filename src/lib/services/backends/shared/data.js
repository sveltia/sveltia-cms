import { IndexedDB } from '@sveltia/utils/storage';
import { allAssets, getAssetFoldersByPath } from '$lib/services/assets';
import { parseAssetFiles } from '$lib/services/assets/parser';
import { isLastCommitPublished } from '$lib/services/backends';
import {
  allEntries,
  dataLoaded,
  entryParseErrors,
  getEntryFoldersByPath,
} from '$lib/services/contents';
import { prepareEntries } from '$lib/services/contents/file/process';

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
 * @param {BaseFileListItem[]} files - Unfiltered file list.
 * @returns {{
 * entryFiles: BaseEntryListItem[],
 * assetFiles: BaseAssetListItem[],
 * allFiles: (BaseEntryListItem | BaseAssetListItem)[],
 * count: number,
 * }} File
 * list, including both entries and assets.
 */
export const createFileList = (files) => {
  /** @type {BaseEntryListItem[]} */
  const entryFiles = [];
  /** @type {BaseAssetListItem[]} */
  const assetFiles = [];

  files.forEach((fileInfo) => {
    const { path } = fileInfo;
    const [entryFolder] = getEntryFoldersByPath(path);
    const [assetFolder] = getAssetFoldersByPath(path, { matchSubFolders: true });

    if (entryFolder) {
      entryFiles.push({ ...fileInfo, type: 'entry', folder: entryFolder });
    }

    // Exclude files already listed as entries. These files can appear in the file list when a
    // relative media path is configured for a collection
    if (assetFolder && !entryFiles.find((e) => e.path === path)) {
      assetFiles.push({ ...fileInfo, type: 'asset', folder: assetFolder });
    }
  });

  const allFiles = [...entryFiles, ...assetFiles];

  return { entryFiles, assetFiles, allFiles, count: allFiles.length };
};

/**
 * Fetch file list from a backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 * @param {object} args - Arguments.
 * @param {RepositoryInfo} args.repository - Repository info.
 * @param {() => Promise<string>} args.fetchDefaultBranchName - Function to fetch the repository’s
 * default branch name.
 * @param {() => Promise<{ hash: string, message: string }>} args.fetchLastCommit - Function to
 * fetch the last commit’s SHA-1 hash and message.
 * @param {(lastHash: string) => Promise<BaseFileListItem[]>} args.fetchFileList - Function to fetch
 * the repository’s complete file list.
 * @param {(fetchingFiles: (BaseEntryListItem | BaseAssetListItem)[]) =>
 * Promise<RepositoryContentsMap>} args.fetchFileContents - Function to fetch the metadata of
 * entry/asset files as well as text file contents.
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
  const cachedFileEntries = await cacheDB.entries();
  let branch = branchName;
  let fileList;

  if (!branch) {
    branch = await fetchDefaultBranchName();
    repository.branch = branch;
  }

  // This has to be done after the branch is determined
  const { hash: lastHash, message } = await fetchLastCommit();

  if (cachedHash && cachedHash === lastHash && cachedFileEntries.length) {
    // Skip fetching the file list if the cached hash matches the latest. But don’t skip if the file
    // cache is empty; something probably went wrong the last time the files were fetched.
    fileList = createFileList(cachedFileEntries.map(([path, data]) => ({ path, ...data })));
  } else {
    // Get a complete file list first, and filter what’s managed in CMS
    fileList = createFileList(await fetchFileList(lastHash));
    metaDB.set('last_commit_hash', lastHash);
  }

  // @todo Check if the commit has a workflow run that trigged deployment
  isLastCommitPublished.set(!message.startsWith('[skip ci]'));

  // Skip fetching files if no files found
  if (!fileList.count) {
    allEntries.set([]);
    allAssets.set([]);
    dataLoaded.set(true);

    return;
  }

  const { entryFiles, assetFiles, allFiles } = fileList;
  const cachedFiles = Object.fromEntries(cachedFileEntries);

  // Restore cached text and commit info
  allFiles.forEach(({ sha, path }, index) => {
    if (cachedFiles[path]?.sha === sha) {
      Object.assign(allFiles[index], cachedFiles[path]);
    }
  });

  const fetchingFiles = allFiles.filter(({ meta }) => !meta);
  const fetchedFileMap = fetchingFiles.length ? await fetchFileContents(fetchingFiles) : {};

  const { entries, errors } = await prepareEntries(
    entryFiles.map((file) => {
      const { text, meta } = fetchedFileMap[file.path] ?? {};

      return {
        ...file,
        text: file.text ?? text,
        meta: file.meta ?? meta,
      };
    }),
  );

  allEntries.set(entries);
  entryParseErrors.set(errors);

  allAssets.set(
    parseAssetFiles(
      assetFiles.map((file) => {
        const { meta, text, size } = fetchedFileMap[file.path] ?? {};

        return {
          ...file,
          name: file.path.split('/').pop(),
          meta: file.meta ?? meta,
          // The size and text are only available in the 2nd request (`fetchFileContents`) on GitLab
          size: file.size ?? size,
          text: file.text ?? text,
        };
      }),
    ),
  );

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
