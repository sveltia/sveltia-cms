import { createLocalizedError } from '$lib/services/backends/git/shared/errors';
import {
  fromRepoPath,
  getRootDir,
  isInRootDir,
  toRepoChanges,
  toRepoPath,
} from '$lib/services/backends/root-dir';

/**
 * @import {
 * BackendService,
 * BaseFileListItem,
 * CommitResults,
 * RepositoryContentsMap,
 * RepositoryInfo,
 * WorkflowBackendService,
 * WorkflowPullRequest,
 * } from '$lib/types/private';
 * @import {
 * FetchFileContentsFunction,
 * FetchFileListFunction,
 * FetchFileMetadataFunction,
 * } from '$lib/services/backends/git/shared/fetch';
 */

/**
 * Wrap a function so it’s replaced with another while a root directory is configured. Without one,
 * the original is called as is, so nothing changes for a site that doesn’t use the option.
 * @template {(...args: any[]) => any} T
 * @param {T} original Original function.
 * @param {(rootDir: string, ...args: Parameters<T>) => ReturnType<T>} scoped Function to call
 * instead, with the root directory as the first argument.
 * @returns {T} Wrapped function.
 */
const whenScoped = (original, scoped) =>
  /** @type {T} */ (
    /**
     * Call the replacement while a root directory is configured, or the original otherwise.
     * @param {Parameters<T>} args Arguments.
     * @returns {ReturnType<T>} Result.
     */
    (...args) => {
      const rootDir = getRootDir();

      return rootDir ? scoped(rootDir, ...args) : original(...args);
    }
  );

/**
 * Re-key a map keyed with file paths.
 * @template T
 * @param {Record<string, T>} map Map.
 * @param {(path: string) => string} convert Function to convert a path.
 * @returns {Record<string, T>} New map.
 */
const convertKeys = (map, convert) =>
  Object.fromEntries(Object.entries(map).map(([path, value]) => [convert(path), value]));

/**
 * Convert the path of a file a pull request changes, along with the path it had before, if any.
 * @template {{ path: string, previousPath?: string }} T
 * @param {T} file File.
 * @param {(path: string) => string} convert Function to convert a path.
 * @returns {T} New file.
 */
const convertFile = (file, convert) => ({
  ...file,
  path: convert(file.path),
  ...(file.previousPath !== undefined && { previousPath: convert(file.previousPath) }),
});

/**
 * Convert the paths of the files a pull request changes.
 * @param {WorkflowPullRequest} pullRequest Pull request.
 * @param {(path: string) => string} convert Function to convert a path.
 * @returns {WorkflowPullRequest} New pull request.
 */
const convertPullRequest = (pullRequest, convert) => ({
  ...pullRequest,
  files: pullRequest.files.map((file) => convertFile(file, convert)),
});

/**
 * Convert the paths of the committed files to paths relative to the root directory.
 * @param {CommitResults} commit Commit results.
 * @param {string} rootDir Root directory.
 * @returns {CommitResults} New commit results.
 */
const scopeCommit = (commit, rootDir) => ({
  ...commit,
  files: convertKeys(commit.files, (path) => fromRepoPath(path, rootDir)),
});

/**
 * Wrap the file fetching functions of a Git backend so the file list only holds the files in the
 * configured root directory, with paths relative to it, while the backend is still given paths
 * relative to the repository root.
 * @param {object} args Arguments.
 * @param {RepositoryInfo} args.repository Repository info.
 * @param {FetchFileListFunction} args.fetchFileList Function to fetch the file list.
 * @param {FetchFileContentsFunction} args.fetchFileContents Function to fetch the contents.
 * @param {FetchFileMetadataFunction} [args.fetchFileMetadata] Function to fetch the metadata.
 * @returns {{
 * fetchFileList: FetchFileListFunction,
 * fetchFileContents: FetchFileContentsFunction,
 * fetchFileMetadata?: FetchFileMetadataFunction,
 * }} Wrapped functions.
 * @throws {Error} When the file list has no file in the root directory, which then doesn’t exist.
 */
export const scopeFileFetchers = ({
  repository,
  fetchFileList,
  fetchFileContents,
  fetchFileMetadata,
}) => {
  /**
   * Give the backend the files with paths relative to the repository root.
   * @param {BaseFileListItem[]} files Files.
   * @param {string} rootDir Root directory.
   * @returns {BaseFileListItem[]} New file list.
   */
  const toRepoFiles = (files, rootDir) =>
    files.map((file) => ({ ...file, path: toRepoPath(file.path, rootDir) }));

  return {
    fetchFileList: whenScoped(fetchFileList, async (rootDir, lastHash) => {
      const files = (await fetchFileList(lastHash)).flatMap((file) => {
        const path = fromRepoPath(file.path, rootDir);

        return isInRootDir(path) ? [{ ...file, path }] : [];
      });

      // Git has no empty directories, so a root directory without a file doesn’t exist, most likely
      // because of a typo. Showing an empty CMS would leave the user wondering where their content
      // has gone
      if (!files.length) {
        throw createLocalizedError('Failed to list the files.', 'root_dir_not_found', {
          repo: `${repository.owner}/${repository.repo}`,
          dir: rootDir,
        });
      }

      return files;
    }),
    fetchFileContents: whenScoped(
      fetchFileContents,
      async (rootDir, files) =>
        /** @type {RepositoryContentsMap} */ (
          convertKeys(await fetchFileContents(toRepoFiles(files, rootDir)), (path) =>
            fromRepoPath(path, rootDir),
          )
        ),
    ),
    fetchFileMetadata:
      fetchFileMetadata &&
      whenScoped(fetchFileMetadata, async (rootDir, files) =>
        convertKeys(await fetchFileMetadata(toRepoFiles(files, rootDir)), (path) =>
          fromRepoPath(path, rootDir),
        ),
      ),
  };
};

/**
 * Wrap the Editorial Workflow implementation of a Git backend, so the paths of the files a pull
 * request changes are relative to the configured root directory.
 * @param {WorkflowBackendService} workflow Workflow implementation.
 * @returns {WorkflowBackendService} Wrapped implementation.
 */
const scopeWorkflow = (workflow) => {
  /**
   * Convert a pull request coming from the CMS.
   * @param {WorkflowPullRequest} pullRequest Pull request.
   * @param {string} rootDir Root directory.
   * @returns {WorkflowPullRequest} Pull request with paths relative to the repository root.
   */
  const toRepo = (pullRequest, rootDir) =>
    convertPullRequest(pullRequest, (path) => toRepoPath(path, rootDir));

  /**
   * Convert a pull request coming from the backend.
   * @param {WorkflowPullRequest} pullRequest Pull request.
   * @param {string} rootDir Root directory.
   * @returns {WorkflowPullRequest} Pull request with paths relative to the root directory.
   */
  const fromRepo = (pullRequest, rootDir) =>
    convertPullRequest(pullRequest, (path) => fromRepoPath(path, rootDir));

  return {
    ...workflow,
    fetchPullRequests: whenScoped(workflow.fetchPullRequests, async (rootDir) =>
      (await workflow.fetchPullRequests()).map((pullRequest) => fromRepo(pullRequest, rootDir)),
    ),
    savePullRequest: whenScoped(workflow.savePullRequest, async (rootDir, args) => {
      const { commit, pullRequest } = await workflow.savePullRequest({
        ...args,
        changes: toRepoChanges(args.changes),
        pullRequest: args.pullRequest && toRepo(args.pullRequest, rootDir),
      });

      return { commit: scopeCommit(commit, rootDir), pullRequest: fromRepo(pullRequest, rootDir) };
    }),
    updateStatus: whenScoped(workflow.updateStatus, async (rootDir, pullRequest, status) =>
      fromRepo(await workflow.updateStatus(toRepo(pullRequest, rootDir), status), rootDir),
    ),
    // A file outside the root directory keeps a path starting with `../`, which matches nothing the
    // CMS has shown, so a pull request touching one isn’t merged
    fetchMergeState: whenScoped(workflow.fetchMergeState, async (rootDir, pullRequest) => {
      const state = await workflow.fetchMergeState(toRepo(pullRequest, rootDir));

      // A path with a `.` or `..` segment, which Git doesn’t allow anyway, wouldn’t convert back to
      // the same file when its changes are checked, so the pull request isn’t vouched for
      const unsafe = state.files.some(({ path, previousPath }) =>
        [path, previousPath].some(
          (_path) => _path !== undefined && _path.split('/').some((s) => s === '.' || s === '..'),
        ),
      );

      return {
        ...state,
        files: state.files.map((file) => convertFile(file, (path) => fromRepoPath(path, rootDir))),
        ...(unsafe && { complete: false }),
      };
    }),
    fetchUnchangedPaths: whenScoped(
      workflow.fetchUnchangedPaths,
      async (rootDir, { headSHA, paths }) =>
        (
          await workflow.fetchUnchangedPaths({
            headSHA,
            paths: paths.map((path) => toRepoPath(path, rootDir)),
          })
        ).map((path) => fromRepoPath(path, rootDir)),
    ),
    publish: whenScoped(workflow.publish, (rootDir, pullRequest) =>
      workflow.publish(toRepo(pullRequest, rootDir)),
    ),
    discard: whenScoped(workflow.discard, (rootDir, pullRequest) =>
      workflow.discard(toRepo(pullRequest, rootDir)),
    ),
  };
};

/**
 * Wrap a Git backend service, so the paths the CMS gives and gets are relative to the configured
 * root directory, while the backend keeps dealing with paths relative to the repository root. The
 * file list is scoped separately, by {@link scopeFileFetchers}, as it’s fetched within the
 * backend’s own `fetchFiles`.
 * @param {BackendService} service Backend service.
 * @returns {BackendService} Wrapped service.
 */
export const scopeBackendService = (service) => {
  const { fetchBlob, commitChanges, fetchFileCommits, workflow } = service;

  return {
    ...service,
    // GitLab and Gitea/Forgejo read an asset file by its path rather than its blob SHA
    fetchBlob:
      fetchBlob &&
      whenScoped(fetchBlob, (rootDir, asset) =>
        fetchBlob({ ...asset, path: toRepoPath(asset.path, rootDir) }),
      ),
    commitChanges: whenScoped(commitChanges, async (rootDir, changes, options) =>
      scopeCommit(await commitChanges(toRepoChanges(changes), options), rootDir),
    ),
    fetchFileCommits:
      fetchFileCommits &&
      whenScoped(fetchFileCommits, (rootDir, paths) =>
        fetchFileCommits(paths.map((path) => toRepoPath(path, rootDir))),
      ),
    workflow: workflow && scopeWorkflow(workflow),
  };
};
