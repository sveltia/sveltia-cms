import { allAssets } from '$lib/services/assets';
import { allEntries, dataLoaded } from '$lib/services/contents';
import { createFileList, parseAssetFiles, parseEntryFiles } from '$lib/services/parser';
import IndexedDB from '$lib/services/utils/indexeddb';

/**
 * Fetch file list from a backend service, download/parse all the entry files, then cache them in
 * the {@link allEntries} and {@link allAssets} stores.
 * @param {object} args - Arguments.
 * @param {string} args.backendName - Backend name, e.g. `github`.
 * @param {RepositoryInfo} args.repository - Repository info.
 * @param {() => Promise<string>} args.fetchDefaultBranchName - Function to fetch the repository’s
 * default branch name.
 * @param {() => Promise<string>} args.fetchLastCommitHash - Function to fetch the latest commit’s
 * SHA-1 hash.
 * @param {() => Promise<BaseFileListItem[]>} args.fetchFileList - Function to fetch the
 * repository’s complete file list.
 * @param {(fetchingFiles: (BaseEntryListItem | BaseAssetListItem)[]) =>
 * Promise<RepositoryContentsMap>} args.fetchFileContents - Function to fetch the metadata of
 * entry/asset files as well as text file contents.
 */
export const fetchAndParseFiles = async ({
  backendName,
  repository,
  fetchDefaultBranchName,
  fetchLastCommitHash,
  fetchFileList,
  fetchFileContents,
}) => {
  const { owner, repo, branch: branchName } = repository;
  const metaDB = new IndexedDB(`${backendName}:${owner}/${repo}`, 'meta');
  const cacheDB = new IndexedDB(`${backendName}:${owner}/${repo}`, 'file-cache');
  const cachedHash = await metaDB.get('last_commit_hash');
  const cachedFileEntries = await cacheDB.entries();
  let branch = branchName;
  let fileList;

  if (!branch) {
    branch = await fetchDefaultBranchName();
    repository.branch = branch;
  }

  // This has to be done after the branch is determined
  const lastHash = await fetchLastCommitHash();

  if (cachedHash && cachedHash === lastHash) {
    // Skip fetching file list
    fileList = createFileList(cachedFileEntries.map(([path, data]) => ({ path, ...data })));
  } else {
    // Get a complete file list first, and filter what’s managed in CMS
    fileList = createFileList(await fetchFileList());
    metaDB.set('last_commit_hash', lastHash);
  }

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

  allEntries.set(
    parseEntryFiles(
      entryFiles.map((file) => ({
        ...file,
        text: file.text ?? fetchedFileMap[file.path].text,
        meta: file.meta ?? fetchedFileMap[file.path].meta,
      })),
    ),
  );

  allAssets.set(
    parseAssetFiles(
      assetFiles.map((file) => ({
        ...file,
        /** Blob URL to be set later via {@link fetchBlob}. */
        url: undefined,
        name: file.path.split('/').pop(),
        meta: file.meta ?? fetchedFileMap[file.path].meta,
      })),
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
