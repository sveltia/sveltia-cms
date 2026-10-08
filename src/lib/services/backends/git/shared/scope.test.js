import { beforeEach, describe, expect, it, vi } from 'vitest';

import { scopeBackendService, scopeFileFetchers } from '$lib/services/backends/git/shared/scope';
import { cmsConfig } from '$lib/services/config';

/**
 * @import {
 * Asset,
 * BackendService,
 * BaseFileListItem,
 * RepositoryInfo,
 * WorkflowBackendService,
 * WorkflowPullRequest,
 * } from '$lib/types/private';
 */

vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));
vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, { values } = {}) => `${key}:${JSON.stringify(values)}`),
}));

const repository = /** @type {RepositoryInfo} */ ({ owner: 'owner', repo: 'repo' });

/**
 * Configure the `root_dir` backend option.
 * @param {string | undefined} rootDir Option value.
 */
const setRootDir = (rootDir) => {
  // @ts-ignore Partial configuration
  cmsConfig.current = { backend: { name: 'github', repo: 'owner/repo', root_dir: rootDir } };
};

/**
 * Create a file list item.
 * @param {string} path File path.
 * @returns {BaseFileListItem} File.
 */
const createFile = (path) => ({
  type: 'config',
  path,
  name: path.split('/').pop() ?? '',
  sha: `sha-${path}`,
  size: 1,
});

/**
 * Create a pull request.
 * @param {string[]} paths Paths of the changed files.
 * @returns {WorkflowPullRequest} Pull request.
 */
const createPullRequest = (paths) => ({
  number: 1,
  title: 'Update',
  branch: 'cms/apps/site/posts/hello',
  status: 'draft',
  createdDate: new Date(0),
  updatedDate: new Date(0),
  files: paths.map((path) => ({ path, sha: `sha-${path}`, size: 1, deleted: false })),
});

describe('scopeFileFetchers()', () => {
  const fetchFileList = vi.fn();
  const fetchFileContents = vi.fn();
  const fetchFileMetadata = vi.fn();

  describe('with a root directory', () => {
    beforeEach(() => {
      setRootDir('apps/site');
    });

    it('should only list the files in the root directory, relative to it', async () => {
      fetchFileList.mockResolvedValue([
        { path: 'apps/site/content/a.md', name: 'a.md', sha: '1', size: 1 },
        { path: 'apps/other/content/b.md', name: 'b.md', sha: '2', size: 1 },
        { path: 'README.md', name: 'README.md', sha: '3', size: 1 },
      ]);

      const scoped = scopeFileFetchers({ repository, fetchFileList, fetchFileContents });

      await expect(scoped.fetchFileList('abc')).resolves.toEqual([
        { path: 'content/a.md', name: 'a.md', sha: '1', size: 1 },
      ]);
      expect(fetchFileList).toHaveBeenCalledWith('abc');
    });

    it('should throw when the root directory holds no file, as it doesn’t exist', async () => {
      fetchFileList.mockResolvedValue([
        { path: 'apps/other/content/b.md', name: 'b.md', sha: '2', size: 1 },
      ]);

      const scoped = scopeFileFetchers({ repository, fetchFileList, fetchFileContents });

      await expect(scoped.fetchFileList('abc')).rejects.toThrow(
        expect.objectContaining({
          message: 'Failed to list the files.',
          cause: expect.objectContaining({
            message: 'root_dir_not_found:{"repo":"owner/repo","dir":"apps/site"}',
          }),
        }),
      );
    });

    it('should fetch the contents with paths relative to the repository root', async () => {
      fetchFileContents.mockResolvedValue({ 'apps/site/content/a.md': { sha: '1', text: 'A' } });

      const scoped = scopeFileFetchers({ repository, fetchFileList, fetchFileContents });

      await expect(scoped.fetchFileContents([createFile('content/a.md')])).resolves.toEqual({
        'content/a.md': { sha: '1', text: 'A' },
      });
      expect(fetchFileContents).toHaveBeenCalledWith([
        expect.objectContaining({ path: 'apps/site/content/a.md' }),
      ]);
    });

    it('should fetch the metadata with paths relative to the repository root', async () => {
      const meta = { commitDate: new Date(0) };

      fetchFileMetadata.mockResolvedValue({ 'apps/site/content/a.md': meta });

      const scoped = scopeFileFetchers({
        repository,
        fetchFileList,
        fetchFileContents,
        fetchFileMetadata,
      });

      await expect(scoped.fetchFileMetadata?.([createFile('content/a.md')])).resolves.toEqual({
        'content/a.md': meta,
      });
      expect(fetchFileMetadata).toHaveBeenCalledWith([
        expect.objectContaining({ path: 'apps/site/content/a.md' }),
      ]);
    });

    it('should not add a metadata fetcher to a backend without one', () => {
      expect(
        scopeFileFetchers({ repository, fetchFileList, fetchFileContents }).fetchFileMetadata,
      ).toBe(undefined);
    });
  });

  describe('without a root directory', () => {
    beforeEach(() => {
      setRootDir(undefined);
    });

    it('should call the original functions as they are', async () => {
      const list = [{ path: 'README.md', name: 'README.md', sha: '3', size: 1 }];
      const contents = {};
      const metadata = {};
      const files = [createFile('README.md')];

      fetchFileList.mockResolvedValue(list);
      fetchFileContents.mockResolvedValue(contents);
      fetchFileMetadata.mockResolvedValue(metadata);

      const scoped = scopeFileFetchers({
        repository,
        fetchFileList,
        fetchFileContents,
        fetchFileMetadata,
      });

      await expect(scoped.fetchFileList('abc')).resolves.toBe(list);
      await expect(scoped.fetchFileContents(files)).resolves.toBe(contents);
      await expect(scoped.fetchFileMetadata?.(files)).resolves.toBe(metadata);
      expect(fetchFileContents).toHaveBeenCalledWith(files);
      expect(fetchFileMetadata).toHaveBeenCalledWith(files);
    });
  });
});

describe('scopeBackendService()', () => {
  const fetchBlob = vi.fn();
  const commitChanges = vi.fn();
  const fetchFileCommits = vi.fn();
  const fetchBranchHead = vi.fn();

  /** @type {Record<string, import('vitest').Mock>} */
  const workflowMocks = {
    fetchPullRequests: vi.fn(),
    savePullRequest: vi.fn(),
    updateStatus: vi.fn(),
    fetchMergeState: vi.fn(),
    fetchUnchangedPaths: vi.fn(),
    publish: vi.fn(),
    discard: vi.fn(),
  };

  /** @type {BackendService} */
  const service = {
    isGit: true,
    name: 'github',
    label: 'GitHub',
    init: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    fetchFiles: vi.fn(),
    fetchBlob,
    commitChanges,
    fetchFileCommits,
    workflow: /** @type {WorkflowBackendService} */ (
      /** @type {unknown} */ ({ ...workflowMocks, fetchBranchHead })
    ),
  };

  const scoped = scopeBackendService(service);
  const { workflow } = /** @type {Required<BackendService>} */ (scoped);

  it('should keep the other properties of the service', () => {
    expect(scoped.name).toBe('github');
    expect(scoped.fetchFiles).toBe(service.fetchFiles);
    expect(workflow.fetchBranchHead).toBe(fetchBranchHead);
  });

  it('should leave out what the service doesn’t have', () => {
    const minimal = scopeBackendService({
      ...service,
      fetchBlob: undefined,
      fetchFileCommits: undefined,
      workflow: undefined,
    });

    expect(minimal.fetchBlob).toBe(undefined);
    expect(minimal.fetchFileCommits).toBe(undefined);
    expect(minimal.workflow).toBe(undefined);
  });

  describe('with a root directory', () => {
    beforeEach(() => {
      setRootDir('apps/site');
    });

    it('should commit the changes with paths relative to the repository root', async () => {
      const file = new Blob(['A']);

      commitChanges.mockResolvedValue({
        sha: 'commit',
        files: { 'apps/site/content/a.md': { sha: '1', file } },
      });

      await expect(
        scoped.commitChanges([{ action: 'create', path: 'content/a.md', data: 'A' }], {
          commitType: 'create',
        }),
      ).resolves.toEqual({ sha: 'commit', files: { 'content/a.md': { sha: '1', file } } });

      expect(commitChanges).toHaveBeenCalledWith(
        [{ action: 'create', path: 'apps/site/content/a.md', data: 'A' }],
        { commitType: 'create' },
      );
    });

    it('should fetch an asset file with the path relative to the repository root', async () => {
      const blob = new Blob(['A']);
      const asset = /** @type {Asset} */ ({ path: 'static/a.png', sha: '1', name: 'a.png' });

      fetchBlob.mockResolvedValue(blob);

      await expect(scoped.fetchBlob?.(asset)).resolves.toBe(blob);
      expect(fetchBlob).toHaveBeenCalledWith({ ...asset, path: 'apps/site/static/a.png' });
      // The asset itself is left alone
      expect(asset.path).toBe('static/a.png');
    });

    it('should fetch the file commits with paths relative to the repository root', async () => {
      const commits = [{ sha: '1', authorName: 'A', date: new Date(0) }];

      fetchFileCommits.mockResolvedValue(commits);

      await expect(scoped.fetchFileCommits?.(['content/a.md'])).resolves.toBe(commits);
      expect(fetchFileCommits).toHaveBeenCalledWith(['apps/site/content/a.md']);
    });

    it('should list the pull requests with paths relative to the root directory', async () => {
      workflowMocks.fetchPullRequests.mockResolvedValue([
        {
          ...createPullRequest(['apps/site/content/a.md']),
          files: [
            {
              path: 'apps/site/content/a.md',
              previousPath: 'apps/site/content/old.md',
              sha: '1',
              size: 1,
              deleted: false,
              renamed: true,
            },
          ],
        },
      ]);

      const [pullRequest] = await workflow.fetchPullRequests();

      expect(pullRequest.files).toEqual([
        {
          path: 'content/a.md',
          previousPath: 'content/old.md',
          sha: '1',
          size: 1,
          deleted: false,
          renamed: true,
        },
      ]);
    });

    it('should save a pull request with paths relative to the repository root', async () => {
      workflowMocks.savePullRequest.mockImplementation(async ({ pullRequest }) => ({
        commit: { sha: 'commit', files: { 'apps/site/content/a.md': { sha: '1' } } },
        pullRequest,
      }));

      const existing = createPullRequest(['content/a.md']);

      const { commit, pullRequest } = await workflow.savePullRequest({
        changes: [{ action: 'update', path: 'content/a.md', data: 'A' }],
        options: { commitType: 'update' },
        branch: 'cms/apps/site/posts/a',
        title: 'Update',
        status: 'draft',
        pullRequest: existing,
      });

      expect(workflowMocks.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: [{ action: 'update', path: 'apps/site/content/a.md', data: 'A' }],
          pullRequest: expect.objectContaining({
            files: [expect.objectContaining({ path: 'apps/site/content/a.md' })],
          }),
        }),
      );
      expect(commit.files).toEqual({ 'content/a.md': { sha: '1' } });
      expect(pullRequest).toEqual(existing);
    });

    it('should save a new pull request', async () => {
      workflowMocks.savePullRequest.mockResolvedValue({
        commit: { sha: 'commit', files: {} },
        pullRequest: createPullRequest(['apps/site/content/a.md']),
      });

      const { pullRequest } = await workflow.savePullRequest({
        changes: [{ action: 'create', path: 'content/a.md', data: 'A' }],
        options: { commitType: 'create' },
        branch: 'cms/apps/site/posts/a',
        title: 'Create',
        status: 'draft',
      });

      expect(workflowMocks.savePullRequest).toHaveBeenCalledWith(
        expect.objectContaining({ pullRequest: undefined }),
      );
      expect(pullRequest.files[0].path).toBe('content/a.md');
    });

    it('should update the status of a pull request', async () => {
      workflowMocks.updateStatus.mockImplementation(async (pullRequest, status) => ({
        ...pullRequest,
        status,
      }));

      const updated = await workflow.updateStatus(
        createPullRequest(['content/a.md']),
        'pending_review',
      );

      expect(workflowMocks.updateStatus.mock.calls[0][0].files[0].path).toBe(
        'apps/site/content/a.md',
      );
      expect(updated.status).toBe('pending_review');
      expect(updated.files[0].path).toBe('content/a.md');
    });

    it('should keep a file outside the root directory in the merge state', async () => {
      workflowMocks.fetchMergeState.mockResolvedValue({
        headSHA: 'head',
        onConfiguredBranches: true,
        complete: true,
        files: [
          { path: 'apps/site/content/a.md', status: 'modified', mode: '100644' },
          {
            path: 'apps/site/content/b.md',
            previousPath: 'apps/site/content/old.md',
            status: 'renamed',
          },
          { path: 'package.json', status: 'modified', mode: '100644' },
        ],
      });

      const state = await workflow.fetchMergeState(createPullRequest(['content/a.md']));

      expect(workflowMocks.fetchMergeState.mock.calls[0][0].files[0].path).toBe(
        'apps/site/content/a.md',
      );
      expect(state.files).toEqual([
        { path: 'content/a.md', status: 'modified', mode: '100644' },
        { path: 'content/b.md', previousPath: 'content/old.md', status: 'renamed' },
        { path: '../../package.json', status: 'modified', mode: '100644' },
      ]);
    });

    it.each([
      ['a path', { path: 'apps/site/../../.github/workflows/x.yml', status: 'modified' }],
      [
        'a previous path',
        { path: 'apps/site/a.md', previousPath: 'apps/site/./b.md', status: 'renamed' },
      ],
    ])('should not vouch for a merge state with %s holding a dot segment', async (_label, file) => {
      workflowMocks.fetchMergeState.mockResolvedValue({
        headSHA: 'head',
        onConfiguredBranches: true,
        complete: true,
        files: [file],
      });

      const state = await workflow.fetchMergeState(createPullRequest(['content/a.md']));

      expect(state.complete).toBe(false);
    });

    it('should find the unchanged paths with paths relative to the repository root', async () => {
      workflowMocks.fetchUnchangedPaths.mockResolvedValue(['apps/site/content/a.md']);

      await expect(
        workflow.fetchUnchangedPaths({ headSHA: 'head', paths: ['content/a.md', 'content/b.md'] }),
      ).resolves.toEqual(['content/a.md']);
      expect(workflowMocks.fetchUnchangedPaths).toHaveBeenCalledWith({
        headSHA: 'head',
        paths: ['apps/site/content/a.md', 'apps/site/content/b.md'],
      });
    });

    it('should publish and discard a pull request', async () => {
      const pullRequest = createPullRequest(['content/a.md']);

      await workflow.publish(pullRequest);
      await workflow.discard(pullRequest);

      expect(workflowMocks.publish.mock.calls[0][0].files[0].path).toBe('apps/site/content/a.md');
      expect(workflowMocks.discard.mock.calls[0][0].files[0].path).toBe('apps/site/content/a.md');
    });
  });

  describe('without a root directory', () => {
    beforeEach(() => {
      setRootDir(undefined);
    });

    it('should call the original functions as they are', async () => {
      const changes = [{ action: /** @type {const} */ ('delete'), path: 'content/a.md' }];
      const options = { commitType: /** @type {const} */ ('delete') };
      const commit = { sha: 'commit', files: {} };
      const pullRequest = createPullRequest(['content/a.md']);

      commitChanges.mockResolvedValue(commit);
      workflowMocks.fetchPullRequests.mockResolvedValue([pullRequest]);
      workflowMocks.updateStatus.mockResolvedValue(pullRequest);

      const asset = /** @type {Asset} */ ({ path: 'static/a.png', sha: '1', name: 'a.png' });

      await scoped.fetchBlob?.(asset);
      expect(fetchBlob).toHaveBeenCalledWith(asset);
      await expect(scoped.commitChanges(changes, options)).resolves.toBe(commit);
      await expect(workflow.fetchPullRequests()).resolves.toEqual([pullRequest]);
      await expect(workflow.updateStatus(pullRequest, 'draft')).resolves.toBe(pullRequest);
      await workflow.publish(pullRequest);

      expect(commitChanges).toHaveBeenCalledWith(changes, options);
      expect(workflowMocks.publish).toHaveBeenCalledWith(pullRequest);
    });
  });
});
