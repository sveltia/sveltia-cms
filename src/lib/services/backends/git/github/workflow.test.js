import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { commitChanges } from '$lib/services/backends/git/github/commits';
import { repository } from '$lib/services/backends/git/github/repository';
import githubWorkflow, {
  createBranch,
  createPullRequest,
  deleteBranch,
  discard,
  fetchPullRequestFileList,
  fetchPullRequestFiles,
  fetchPullRequests,
  parsePullRequest,
  publish,
  savePullRequest,
  updateDraftState,
  updateLabels,
  updateStatus,
} from '$lib/services/backends/git/github/workflow';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';

vi.mock('$lib/services/backends/git/github/commits');
vi.mock('$lib/services/backends/git/github/repository', () => ({
  repository: { owner: 'owner', repo: 'repo', branch: 'main' },
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { subscribe: vi.fn() } }));
vi.mock('svelte/store', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  get: vi.fn(),
}));

/**
 * Create a raw pull request node as returned by the GraphQL API.
 * @param {object} [overrides] Properties to override.
 * @returns {any} Node.
 */
const createNode = (overrides = {}) => ({
  id: 'PR_1',
  number: 1,
  title: 'Create Post “hello”',
  url: 'https://github.com/owner/repo/pull/1',
  isDraft: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  headRefName: 'cms/posts/hello',
  author: {
    login: 'me',
    name: 'Me',
    email: 'me@example.com',
    databaseId: 123,
    avatarUrl: 'https://example.com/a.png',
  },
  labels: { nodes: [{ name: 'sveltia-cms/draft' }] },
  files: { nodes: [{ path: 'content/posts/hello.md', changeType: 'ADDED' }] },
  ...overrides,
});

describe('GitHub Editorial Workflow service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(get).mockReturnValue({ backend: { name: 'github' } });
    vi.mocked(fetchAPI).mockResolvedValue({});
    vi.mocked(fetchGraphQL).mockResolvedValue({});
  });

  test('exports the expected service structure', () => {
    expect(githubWorkflow).toEqual({
      fetchPullRequests: expect.any(Function),
      savePullRequest: expect.any(Function),
      updateStatus: expect.any(Function),
      publish: expect.any(Function),
      discard: expect.any(Function),
    });
  });

  describe('parsePullRequest', () => {
    test('parses a CMS-managed pull request', () => {
      const result = parsePullRequest(createNode());

      expect(result).toEqual({
        number: 1,
        nodeId: 'PR_1',
        title: 'Create Post “hello”',
        url: 'https://github.com/owner/repo/pull/1',
        branch: 'cms/posts/hello',
        status: 'draft',
        createdDate: new Date('2026-01-01T00:00:00Z'),
        updatedDate: new Date('2026-01-02T00:00:00Z'),
        author: { name: 'Me', email: 'me@example.com', id: 123, login: 'me' },
        files: [
          {
            path: 'content/posts/hello.md',
            sha: '',
            size: 0,
            deleted: false,
            renamed: false,
          },
        ],
      });
    });

    test('returns undefined without a CMS label', () => {
      expect(
        parsePullRequest(createNode({ labels: { nodes: [{ name: 'bug' }] } })),
      ).toBeUndefined();
    });

    test('picks up a pull request created with Netlify/Decap CMS', () => {
      const result = parsePullRequest(
        createNode({ labels: { nodes: [{ name: 'decap-cms/pending_review' }] } }),
      );

      expect(result?.status).toBe('pending_review');
    });

    test('flags the change types that need a follow-up REST request', () => {
      const files = parsePullRequest(
        createNode({
          files: {
            nodes: [
              { path: 'content/posts/hello.md', changeType: 'MODIFIED' },
              { path: 'content/posts/old.md', changeType: 'DELETED' },
              { path: 'content/posts/renamed.md', changeType: 'RENAMED' },
            ],
          },
        }),
      )?.files;

      expect(files?.map(({ deleted, renamed }) => ({ deleted, renamed }))).toEqual([
        { deleted: false, renamed: false },
        { deleted: true, renamed: false },
        { deleted: false, renamed: true },
      ]);
    });

    test('handles a pull request with no changed file', () => {
      expect(parsePullRequest(createNode({ files: null }))?.files).toEqual([]);
    });

    test('handles a missing author and a bot author without a name', () => {
      expect(parsePullRequest(createNode({ author: null }))?.author).toBeUndefined();

      expect(parsePullRequest(createNode({ author: { login: 'bot' } }))?.author).toEqual({
        name: 'bot',
        email: '',
        id: undefined,
        login: 'bot',
      });
    });
  });

  describe('fetchPullRequestFileList', () => {
    test('maps the REST response, keeping the path a rename came from', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([
        { filename: 'content/posts/hello.md', status: 'modified' },
        { filename: 'content/posts/old.md', status: 'removed' },
        {
          filename: 'content/posts/renamed.md',
          status: 'renamed',
          previous_filename: 'content/posts/before.md',
        },
      ]);

      const pullRequest = /** @type {any} */ ({ number: 1, files: [] });

      await fetchPullRequestFileList(pullRequest);

      expect(fetchAPI).toHaveBeenCalledWith('/repos/owner/repo/pulls/1/files?per_page=100');

      expect(pullRequest.files).toEqual([
        {
          path: 'content/posts/hello.md',
          sha: '',
          size: 0,
          deleted: false,
          previousPath: undefined,
        },
        { path: 'content/posts/old.md', sha: '', size: 0, deleted: true, previousPath: undefined },
        {
          path: 'content/posts/renamed.md',
          sha: '',
          size: 0,
          deleted: false,
          previousPath: 'content/posts/before.md',
        },
      ]);
    });
  });

  describe('fetchPullRequestFiles', () => {
    test('does nothing when there is no file to fetch', async () => {
      await fetchPullRequestFiles([]);
      expect(fetchGraphQL).not.toHaveBeenCalled();
    });

    test('populates the file content', async () => {
      const pullRequest = /** @type {any} */ ({
        branch: 'cms/posts/hello',
        files: [
          { path: 'content/posts/hello.md', sha: '', size: 0, deleted: false },
          { path: 'static/img.png', sha: '', size: 0, deleted: false },
          { path: 'content/posts/old.md', sha: '', size: 0, deleted: true },
        ],
      });

      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          file_0: { oid: 'sha1', byteSize: 7, isBinary: false, text: '# Hello' },
          file_1: { oid: 'sha2', byteSize: 99, isBinary: true, text: null },
        },
      });

      await fetchPullRequestFiles([pullRequest]);

      expect(pullRequest.files[0]).toEqual({
        path: 'content/posts/hello.md',
        sha: 'sha1',
        size: 7,
        text: '# Hello',
        deleted: false,
      });

      expect(pullRequest.files[1].text).toBeUndefined();
      // Deleted files are skipped
      expect(pullRequest.files[2].sha).toBe('');
    });

    test('normalizes a null text for an empty text file', async () => {
      const pullRequest = /** @type {any} */ ({
        branch: 'cms/posts/hello',
        files: [{ path: 'content/posts/hello.md', sha: '', size: 0, deleted: false }],
      });

      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: { file_0: { oid: 'sha1', byteSize: 0, isBinary: false, text: null } },
      });

      await fetchPullRequestFiles([pullRequest]);

      expect(pullRequest.files[0].text).toBeUndefined();
    });

    test('marks a file as deleted when the blob is missing', async () => {
      const pullRequest = /** @type {any} */ ({
        branch: 'cms/posts/hello',
        files: [{ path: 'content/posts/hello.md', sha: '', size: 0, deleted: false }],
      });

      vi.mocked(fetchGraphQL).mockResolvedValue({ repository: {} });
      await fetchPullRequestFiles([pullRequest]);

      expect(pullRequest.files[0].deleted).toBe(true);
    });
  });

  describe('fetchPullRequests', () => {
    test('returns only the CMS-managed pull requests with their file contents', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          repository: {
            pullRequests: {
              nodes: [createNode(), createNode({ labels: { nodes: [{ name: 'bug' }] } })],
            },
          },
        })
        .mockResolvedValueOnce({
          repository: { file_0: { oid: 'sha1', byteSize: 7, isBinary: false, text: '# Hello' } },
        });

      const result = await fetchPullRequests();

      expect(result).toHaveLength(1);
      expect(result[0].files[0].text).toBe('# Hello');
      // The paths come from the pull request query itself, so no REST request is needed
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    test('asks the API to match the status labels, including the legacy ones', async () => {
      await fetchPullRequests();

      const [query] = vi.mocked(fetchGraphQL).mock.calls[0];

      // The cap has to apply to the CMS’s own pull requests, not to the whole repository
      expect(query).toContain('labels: ["sveltia-cms/draft"');
      expect(query).toContain('"decap-cms/pending_publish"]');
      expect(query).toContain('first: 100');
    });

    test('falls back to the REST API only for a pull request with a renamed file', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({
          repository: {
            pullRequests: {
              nodes: [
                createNode({
                  files: {
                    nodes: [{ path: 'content/posts/renamed.md', changeType: 'RENAMED' }],
                  },
                }),
              ],
            },
          },
        })
        .mockResolvedValueOnce({
          repository: { file_0: { oid: 'sha1', byteSize: 7, isBinary: false, text: '# Hello' } },
        });

      vi.mocked(fetchAPI).mockResolvedValue([
        {
          filename: 'content/posts/renamed.md',
          status: 'renamed',
          previous_filename: 'content/posts/hello.md',
        },
      ]);

      const result = await fetchPullRequests();

      expect(fetchAPI).toHaveBeenCalledWith('/repos/owner/repo/pulls/1/files?per_page=100');
      expect(result[0].files[0].previousPath).toBe('content/posts/hello.md');
    });

    test('handles an empty response', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({});
      await expect(fetchPullRequests()).resolves.toEqual([]);
    });
  });

  describe('createBranch', () => {
    /**
     * Mock the base query that supplies the repository node ID and the configured branch head.
     */
    const mockBase = () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: { id: 'R_1', ref: { target: { oid: 'abc' } } },
      });
    };

    test('creates the reference with a mutation, which never returns a failed HTTP status', async () => {
      mockBase();
      vi.mocked(fetchAPI).mockResolvedValue({ data: { createRef: { ref: { name: 'x' } } } });

      await expect(createBranch('cms/posts/hello')).resolves.toBe('abc');

      expect(fetchAPI).toHaveBeenCalledWith('', {
        method: 'POST',
        isGraphQL: true,
        body: {
          query: expect.stringContaining('createRef'),
          variables: {
            input: {
              repositoryId: 'R_1',
              name: 'refs/heads/cms/posts/hello',
              oid: 'abc',
            },
          },
        },
      });
    });

    test('ignores an existing reference', async () => {
      mockBase();
      // An earlier pull request for the same entry can leave the branch behind
      vi.mocked(fetchAPI).mockResolvedValue({
        data: { createRef: null },
        errors: [
          { message: 'A ref named "refs/heads/cms/posts/hello" already exists in the repository.' },
        ],
      });

      await expect(createBranch('cms/posts/hello')).resolves.toBeUndefined();
    });

    test('rethrows any other mutation error', async () => {
      mockBase();
      vi.mocked(fetchAPI).mockResolvedValue({
        data: { createRef: null },
        errors: [{ message: 'Resource not accessible by integration' }],
      });

      await expect(createBranch('cms/posts/hello')).rejects.toThrow('Failed to create the branch.');
    });

    test('reports a missing repository or configured branch', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({ repository: null });
      await expect(createBranch('cms/posts/hello')).rejects.toThrow('Failed to create the branch.');

      vi.mocked(fetchGraphQL).mockResolvedValue({ repository: { id: 'R_1', ref: null } });
      await expect(createBranch('cms/posts/hello')).rejects.toThrow('Failed to create the branch.');

      expect(fetchAPI).not.toHaveBeenCalled();
    });
  });

  describe('deleteBranch', () => {
    test('deletes the reference', async () => {
      await deleteBranch('cms/posts/hello');

      expect(fetchAPI).toHaveBeenCalledWith('/repos/owner/repo/git/refs/heads/cms/posts/hello', {
        method: 'DELETE',
        responseType: 'raw',
      });
    });

    test('ignores a failure', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Not found'));
      await expect(deleteBranch('cms/posts/hello')).resolves.toBeUndefined();
    });
  });

  describe('updateLabels', () => {
    test('replaces the CMS label while preserving the others', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({
        labels: [{ name: 'bug' }, { name: 'sveltia-cms/draft' }],
      });

      await updateLabels(/** @type {any} */ ({ number: 1 }), 'pending_review');

      expect(fetchAPI).toHaveBeenLastCalledWith('/repos/owner/repo/issues/1', {
        method: 'PATCH',
        body: { labels: ['bug', 'sveltia-cms/pending_review'] },
      });
    });

    test('strips a Netlify/Decap CMS label and applies the configured one', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({
        labels: [{ name: 'decap-cms/draft' }, { name: 'enhancement' }],
      });

      await updateLabels(/** @type {any} */ ({ number: 3 }), 'pending_review');

      expect(fetchAPI).toHaveBeenLastCalledWith('/repos/owner/repo/issues/3', {
        method: 'PATCH',
        body: { labels: ['enhancement', 'sveltia-cms/pending_review'] },
      });
    });

    test('handles a pull request without labels', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({});

      await updateLabels(/** @type {any} */ ({ number: 2 }), 'draft');

      expect(fetchAPI).toHaveBeenLastCalledWith('/repos/owner/repo/issues/2', {
        method: 'PATCH',
        body: { labels: ['sveltia-cms/draft'] },
      });
    });
  });

  describe('updateDraftState', () => {
    test('converts a pull request to a draft', async () => {
      await updateDraftState(/** @type {any} */ ({ nodeId: 'PR_1' }), true);

      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('convertPullRequestToDraft'),
        { input: { pullRequestId: 'PR_1' } },
      );
    });

    test('marks a pull request ready for review', async () => {
      await updateDraftState(/** @type {any} */ ({ nodeId: 'PR_1' }), false);

      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('markPullRequestReadyForReview'),
        { input: { pullRequestId: 'PR_1' } },
      );
    });
  });

  describe('createPullRequest', () => {
    test('creates a draft pull request and applies the draft label', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({
          number: 5,
          node_id: 'PR_5',
          title: 'Create Post “hello”',
          html_url: 'https://github.com/owner/repo/pull/5',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        })
        .mockResolvedValueOnce({});

      const result = await createPullRequest({
        branch: 'cms/posts/hello',
        title: 'Create Post “hello”',
      });

      expect(fetchAPI).toHaveBeenNthCalledWith(1, '/repos/owner/repo/pulls', {
        method: 'POST',
        body: expect.objectContaining({
          head: 'cms/posts/hello',
          base: 'main',
          draft: true,
        }),
      });

      // A new pull request has no label to preserve, so it’s added without reading the list first
      expect(fetchAPI).toHaveBeenNthCalledWith(2, '/repos/owner/repo/issues/5/labels', {
        method: 'POST',
        body: { labels: ['sveltia-cms/draft'] },
      });

      expect(fetchAPI).toHaveBeenCalledTimes(2);

      expect(result).toEqual(
        expect.objectContaining({ number: 5, nodeId: 'PR_5', status: 'draft', files: [] }),
      );
    });
  });

  describe('savePullRequest', () => {
    const args = /** @type {any} */ ({
      changes: [],
      options: { commitType: 'create' },
      branch: 'cms/posts/hello',
      title: 'Create Post “hello”',
    });

    test('creates the branch and the pull request on the first save', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: { id: 'R_1', ref: { target: { oid: 'abc' } } },
      });
      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ data: { createRef: { ref: { name: 'x' } } } })
        .mockResolvedValueOnce({
          number: 5,
          node_id: 'PR_5',
          title: 'x',
          html_url: 'u',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        })
        .mockResolvedValueOnce({});

      const result = await savePullRequest(args);

      // The branch was just created at this commit, so the backend doesn’t look its head up again
      expect(commitChanges).toHaveBeenCalledWith([], {
        commitType: 'create',
        branch: 'cms/posts/hello',
        headOid: 'abc',
      });

      expect(result.pullRequest.number).toBe(5);
    });

    test('looks the head up when the branch was left over by an interrupted save', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: { id: 'R_1', ref: { target: { oid: 'abc' } } },
      });
      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });
      vi.mocked(fetchAPI).mockResolvedValueOnce({
        data: { createRef: null },
        errors: [{ message: 'already exists' }],
      });

      await savePullRequest(args).catch(() => undefined);

      expect(commitChanges).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ headOid: undefined }),
      );
    });

    test('reuses an existing pull request without creating a branch', async () => {
      const pullRequest = /** @type {any} */ ({ number: 5, branch: 'cms/posts/hello' });

      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });

      const result = await savePullRequest({ ...args, pullRequest });

      expect(fetchGraphQL).not.toHaveBeenCalled();
      expect(commitChanges).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ headOid: undefined }),
      );
      expect(result.pullRequest).toBe(pullRequest);
    });
  });

  describe('updateStatus', () => {
    test('updates the label and the draft state', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({ labels: [] }).mockResolvedValueOnce({});

      const result = await updateStatus(
        /** @type {any} */ ({ number: 1, nodeId: 'PR_1', status: 'draft' }),
        'pending_publish',
      );

      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('markPullRequestReadyForReview'),
        expect.anything(),
      );

      expect(result.status).toBe('pending_publish');
    });

    test('converts the pull request back to a draft', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({ labels: [] }).mockResolvedValueOnce({});

      await updateStatus(
        /** @type {any} */ ({ number: 1, nodeId: 'PR_1', status: 'pending_review' }),
        'draft',
      );

      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('convertPullRequestToDraft'),
        expect.anything(),
      );
    });

    test('leaves the draft state alone when it doesn’t change', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({ labels: [] }).mockResolvedValueOnce({});

      // Both the review and ready stages are non-draft pull requests
      const result = await updateStatus(
        /** @type {any} */ ({ number: 1, nodeId: 'PR_1', status: 'pending_review' }),
        'pending_publish',
      );

      expect(fetchGraphQL).not.toHaveBeenCalled();
      expect(result.status).toBe('pending_publish');
    });
  });

  describe('publish', () => {
    test('merges the pull request and deletes the branch', async () => {
      await publish(
        /** @type {any} */ ({ number: 1, branch: 'cms/posts/hello', title: 'Create Post' }),
      );

      expect(fetchAPI).toHaveBeenNthCalledWith(1, '/repos/owner/repo/pulls/1/merge', {
        method: 'PUT',
        body: { merge_method: 'merge', commit_title: 'Create Post' },
      });

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        '/repos/owner/repo/git/refs/heads/cms/posts/hello',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    test('uses a squash merge when configured', async () => {
      vi.mocked(get).mockReturnValue({ backend: { name: 'github', squash_merges: true } });

      await publish(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello', title: 't' }));

      expect(fetchAPI).toHaveBeenNthCalledWith(
        1,
        '/repos/owner/repo/pulls/1/merge',
        expect.objectContaining({ body: expect.objectContaining({ merge_method: 'squash' }) }),
      );
    });

    test('falls back to a regular merge without the config', async () => {
      vi.mocked(get).mockReturnValue(undefined);

      await publish(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello', title: 't' }));

      expect(fetchAPI).toHaveBeenNthCalledWith(
        1,
        '/repos/owner/repo/pulls/1/merge',
        expect.objectContaining({ body: expect.objectContaining({ merge_method: 'merge' }) }),
      );
    });
  });

  describe('discard', () => {
    test('closes the pull request and deletes the branch', async () => {
      await discard(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello' }));

      expect(fetchAPI).toHaveBeenNthCalledWith(1, '/repos/owner/repo/pulls/1', {
        method: 'PATCH',
        body: { state: 'closed' },
      });

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        '/repos/owner/repo/git/refs/heads/cms/posts/hello',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  test('the repository info is used as the base branch', () => {
    expect(repository.branch).toBe('main');
  });
});
