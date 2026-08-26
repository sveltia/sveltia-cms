import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { commitChanges } from '$lib/services/backends/git/github/commits';
import { repository } from '$lib/services/backends/git/github/repository';
import githubWorkflow, {
  createBranch,
  createPullRequest,
  deleteBranch,
  discard,
  fetchForkBranches,
  fetchForkBranchFileList,
  fetchForkBranchPullRequests,
  fetchForkPullRequests,
  fetchPullRequestFileList,
  fetchPullRequestFiles,
  fetchPullRequests,
  parseForkBranch,
  parsePullRequest,
  publish,
  reopenPullRequest,
  savePullRequest,
  updateDraftState,
  updateForkStatus,
  updateLabels,
  updateStatus,
} from '$lib/services/backends/git/github/workflow';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { forkedRepository, openAuthoring } from '$lib/services/workflow/open-authoring';

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
  headRefOid: 'abc123',
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

/**
 * Stub the store reader used across the workflow service: the site configuration, and the Open
 * Authoring state that decides which of the two flows a call takes.
 * @param {object} [args] Arguments.
 * @param {object | null} [args.backend] Backend configuration, or `null` for no configuration at
 * all. It can’t be `undefined`, which the parameter default would replace.
 * @param {{ owner: string, repo: string }} [args.fork] Fork the contributor writes to, which turns
 * the Open Authoring flow on.
 */
const mockStores = ({ backend = { name: 'github' }, fork = undefined } = {}) => {
  vi.mocked(get).mockImplementation((/** @type {any} */ store) => {
    if (store === forkedRepository) {
      return fork;
    }

    if (store === openAuthoring) {
      return !!fork;
    }

    return backend ? { backend } : undefined;
  });
};

describe('GitHub Editorial Workflow service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStores();
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
    test('ignores a pull request from a fork', () => {
      // An Open Authoring contribution that a maintainer labelled by hand: the branch isn’t on the
      // configured repository, so the card would report every file as deleted
      expect(parsePullRequest(createNode({ isCrossRepository: true }))).toBeUndefined();
    });

    test('parses a CMS-managed pull request', () => {
      const result = parsePullRequest(createNode());

      expect(result).toEqual({
        number: 1,
        nodeId: 'PR_1',
        title: 'Create Post “hello”',
        url: 'https://github.com/owner/repo/pull/1',
        branch: 'cms/posts/hello',
        headSHA: 'abc123',
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
      expect(query).toContain('"decap-cms/pending_deletion"]');
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
        fork: { id: 'R_1' },
        base: { ref: { target: { oid: 'abc' } } },
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

      // A GraphQL error comes back as a rejection carrying the message, not as a resolved response
      // with an `errors` key. The branch is left behind by an earlier pull request for the same
      // entry — one merged without deleting the branch, or discarded — and is fine to commit onto
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', {
          cause: {
            status: 200,
            message: 'A ref named "refs/heads/cms/posts/hello" already exists in the repository.',
          },
        }),
      );

      await expect(createBranch('cms/posts/hello')).resolves.toBeUndefined();
    });

    test('rethrows any other mutation error', async () => {
      mockBase();
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', {
          cause: { status: 200, message: 'Resource not accessible by integration' },
        }),
      );

      await expect(createBranch('cms/posts/hello')).rejects.toThrow('Failed to create the branch.');
    });

    test('rethrows an error that carries no cause', async () => {
      mockBase();
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Failed to send the request'));

      await expect(createBranch('cms/posts/hello')).rejects.toThrow('Failed to create the branch.');
    });

    test('reports a missing repository or configured branch', async () => {
      // The fork the branch goes in
      vi.mocked(fetchGraphQL).mockResolvedValue({ fork: null, base: {} });
      await expect(createBranch('cms/posts/hello')).rejects.toThrow('Failed to create the branch.');

      // The configured repository the branch starts from
      vi.mocked(fetchGraphQL).mockResolvedValue({ fork: { id: 'R_1' }, base: null });
      await expect(createBranch('cms/posts/hello')).rejects.toThrow('Failed to create the branch.');

      vi.mocked(fetchGraphQL).mockResolvedValue({ fork: { id: 'R_1' }, base: { ref: null } });
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
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        })
        .mockResolvedValueOnce({});

      const result = await createPullRequest({
        branch: 'cms/posts/hello',
        title: 'Create Post “hello”',
        status: 'draft',
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
        expect.objectContaining({
          number: 5,
          nodeId: 'PR_5',
          headSHA: 'abc123',
          status: 'draft',
          files: [],
        }),
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
        fork: { id: 'R_1' },
        base: { ref: { target: { oid: 'abc' } } },
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
        fork: { id: 'R_1' },
        base: { ref: { target: { oid: 'abc' } } },
      });
      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });
      vi.mocked(fetchAPI).mockRejectedValueOnce(
        new Error('Server responded with an error', {
          cause: { status: 200, message: 'already exists' },
        }),
      );

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
      mockStores({ backend: { name: 'github', squash_merges: true } });

      await publish(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello', title: 't' }));

      expect(fetchAPI).toHaveBeenNthCalledWith(
        1,
        '/repos/owner/repo/pulls/1/merge',
        expect.objectContaining({ body: expect.objectContaining({ merge_method: 'squash' }) }),
      );
    });

    test('falls back to a regular merge without the config', async () => {
      mockStores({ backend: null });

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

  describe('Open Authoring', () => {
    /** The fork every test in this block writes to. */
    const fork = { owner: 'contributor', repo: 'repo' };
    /** The workflow branch the fixtures below describe. */
    const BRANCH = 'cms/contributor/repo/posts/hello';

    /**
     * Create a raw ref node as returned by the branch listing query.
     * @param {object} [overrides] Properties to override.
     * @returns {any} Node.
     */
    const createRefNode = (overrides = {}) => ({
      name: 'posts/hello',
      target: {
        oid: 'branch-head',
        message: 'Create Post “hello”',
        committedDate: '2026-01-03T00:00:00Z',
        author: {
          name: 'Me',
          email: 'me@example.com',
          user: { login: 'contributor', databaseId: 123 },
        },
      },
      ...overrides,
    });

    /**
     * Create a raw pull request node as returned by the branch listing query.
     * @param {object} [overrides] Properties to override.
     * @returns {any} Node.
     */
    const createBranchPullRequest = (overrides = {}) => ({
      id: 'PR_1',
      number: 1,
      title: 'Create Post “hello”',
      url: 'https://github.com/owner/repo/pull/1',
      state: 'OPEN',
      isDraft: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      headRefOid: 'branch-head',
      headRepositoryOwner: { login: 'contributor' },
      files: { nodes: [{ path: 'content/posts/hello.md', changeType: 'ADDED' }] },
      ...overrides,
    });

    beforeEach(() => {
      mockStores({ fork });
    });

    describe('parseForkBranch', () => {
      test('a branch without a pull request is a draft', () => {
        const result = parseForkBranch(createRefNode(), BRANCH);

        expect(result).toEqual({
          number: undefined,
          nodeId: undefined,
          // The head commit’s message stands in for the title a pull request would carry
          title: 'Create Post “hello”',
          url: undefined,
          branch: BRANCH,
          status: 'draft',
          createdDate: new Date('2026-01-03T00:00:00Z'),
          updatedDate: new Date('2026-01-03T00:00:00Z'),
          author: { name: 'Me', email: 'me@example.com', id: 123, login: 'contributor' },
          files: [],
        });
      });

      test('takes the file list off an open pull request', () => {
        // Reading them here saves comparing the branch with the configured branch, which answers
        // with a diff of every file
        expect(parseForkBranch(createRefNode(), BRANCH, createBranchPullRequest())?.files).toEqual([
          {
            path: 'content/posts/hello.md',
            sha: '',
            size: 0,
            deleted: false,
            renamed: false,
          },
        ]);
      });

      test('copes with an open pull request that reports no file list', () => {
        const pullRequest = createBranchPullRequest({ files: undefined });

        expect(parseForkBranch(createRefNode(), BRANCH, pullRequest)?.files).toEqual([]);
      });

      test('leaves the file list empty without an open pull request', () => {
        // A branch with no pull request has nothing to read them from, and a closed one’s diff is
        // no longer a reliable account of a branch that has moved on since
        expect(parseForkBranch(createRefNode(), BRANCH)?.files).toEqual([]);

        const closed = createBranchPullRequest({ state: 'CLOSED' });

        expect(parseForkBranch(createRefNode(), BRANCH, closed)?.files).toEqual([]);
      });

      test('an open pull request means the entry is in review', () => {
        expect(parseForkBranch(createRefNode(), BRANCH, createBranchPullRequest())).toEqual(
          expect.objectContaining({
            number: 1,
            nodeId: 'PR_1',
            url: 'https://github.com/owner/repo/pull/1',
            status: 'pending_review',
            createdDate: new Date('2026-01-01T00:00:00Z'),
            updatedDate: new Date('2026-01-02T00:00:00Z'),
          }),
        );
      });

      test('a draft or closed pull request keeps the entry in the drafting stage', () => {
        const asDraft = createBranchPullRequest({ isDraft: true });

        expect(parseForkBranch(createRefNode(), BRANCH, asDraft)?.status).toBe('draft');

        const closed = createBranchPullRequest({ state: 'CLOSED' });

        expect(parseForkBranch(createRefNode(), BRANCH, closed)?.status).toBe('draft');
      });

      test('a merged pull request is treated as none at all', () => {
        // The branch may simply be left over, in which case comparing it turns up nothing and it
        // drops off the board. But the contributor may also have edited the entry again since the
        // merge, which makes it a fresh draft rather than something to reopen
        const merged = createBranchPullRequest({ state: 'MERGED' });
        const result = parseForkBranch(createRefNode(), BRANCH, merged);

        expect(result).toEqual(
          expect.objectContaining({
            number: undefined,
            nodeId: undefined,
            status: 'draft',
            files: [],
          }),
        );
      });

      test('copes with a commit author who has no public email address', () => {
        const node = createRefNode({
          target: {
            message: 'Create Post “hello”',
            committedDate: '2026-01-03T00:00:00Z',
            author: { name: 'Me', user: { login: 'contributor', databaseId: 123 } },
          },
        });

        expect(parseForkBranch(node, BRANCH)?.author).toEqual({
          name: 'Me',
          email: '',
          id: 123,
          login: 'contributor',
        });
      });

      test('copes with a branch whose head commit couldn’t be read', () => {
        const node = createRefNode({ target: undefined });

        expect(parseForkBranch(node, BRANCH)).toEqual(
          expect.objectContaining({ title: '', author: undefined }),
        );
      });
    });

    describe('fetchForkBranchPullRequests', () => {
      test('looks the pull requests up on the configured repository, not the fork', async () => {
        // A ref in the fork doesn’t report the pull requests opened from it against the configured
        // repository, so asking the fork would find nothing
        vi.mocked(fetchGraphQL).mockResolvedValue({
          repository: { pr_0: { nodes: [createBranchPullRequest()] } },
        });

        const result = await fetchForkBranchPullRequests([BRANCH]);

        expect(fetchGraphQL).toHaveBeenCalledWith(
          expect.stringContaining(`headRefName: "${BRANCH}"`),
        );

        expect(result.get(BRANCH)).toEqual(expect.objectContaining({ number: 1 }));
      });

      test('ignores a pull request from a branch of the same name elsewhere', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({
          repository: {
            pr_0: {
              nodes: [createBranchPullRequest({ headRepositoryOwner: { login: 'someone-else' } })],
            },
          },
        });

        const result = await fetchForkBranchPullRequests([BRANCH]);

        expect(result.size).toBe(0);
      });

      test('sends no request without branches to look up', async () => {
        const result = await fetchForkBranchPullRequests([]);

        expect(result.size).toBe(0);
        expect(fetchGraphQL).not.toHaveBeenCalled();
      });

      test('copes with a repository that reports nothing', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({});

        const result = await fetchForkBranchPullRequests([BRANCH]);

        expect(result.size).toBe(0);
      });
    });

    describe('fetchForkBranches', () => {
      test('queries the fork with the branch prefix', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({
          repository: { refs: { nodes: [createRefNode()] } },
        });

        const result = await fetchForkBranches();

        expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('refs('), {
          owner: 'contributor',
          repo: 'repo',
          prefix: 'refs/heads/cms/contributor/repo/',
        });

        expect(result).toHaveLength(1);
        expect(result[0].branch).toBe('cms/contributor/repo/posts/hello');
      });

      test('deletes a branch left behind by a merged pull request', async () => {
        vi.mocked(fetchGraphQL).mockImplementation(async (query) =>
          query.includes('refs(')
            ? { repository: { refs: { nodes: [createRefNode()] } } }
            : {
                repository: {
                  // Merged, and the branch still points at the head it was merged at
                  pr_0: { nodes: [createBranchPullRequest({ state: 'MERGED' })] },
                },
              },
        );

        const result = await fetchForkBranches();

        expect(result).toEqual([]);
        expect(fetchAPI).toHaveBeenCalledWith(
          '/repos/contributor/repo/git/refs/heads/cms/contributor/repo/posts/hello',
          expect.objectContaining({ method: 'DELETE' }),
        );
      });

      test('keeps a branch committed to since its pull request was merged', async () => {
        vi.mocked(fetchGraphQL).mockImplementation(async (query) =>
          query.includes('refs(')
            ? { repository: { refs: { nodes: [createRefNode()] } } }
            : {
                repository: {
                  // The branch has moved on since the merge, so the entry is being edited again
                  pr_0: {
                    nodes: [createBranchPullRequest({ state: 'MERGED', headRefOid: 'older-head' })],
                  },
                },
              },
        );

        const result = await fetchForkBranches();

        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('draft');
        expect(fetchAPI).not.toHaveBeenCalled();
      });

      test('says something when the branch list comes back full', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        vi.mocked(fetchGraphQL).mockImplementation(async (query) =>
          query.includes('refs(')
            ? {
                repository: {
                  refs: {
                    // A full page means an arbitrary set of branches was left off the board
                    nodes: Array.from({ length: 100 }, (_item, index) =>
                      createRefNode({ name: `posts/entry-${index}` }),
                    ),
                  },
                },
              }
            : { repository: {} },
        );

        await fetchForkBranches();

        expect(warn).toHaveBeenCalledWith(expect.stringContaining('Only the first 100'));
        warn.mockRestore();
      });

      test('stays quiet when the branch list fits', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        vi.mocked(fetchGraphQL).mockImplementation(async (query) =>
          query.includes('refs(')
            ? { repository: { refs: { nodes: [createRefNode()] } } }
            : { repository: {} },
        );

        await fetchForkBranches();

        expect(warn).not.toHaveBeenCalled();
        warn.mockRestore();
      });

      test('returns nothing when the fork can’t be read', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({});
        await expect(fetchForkBranches()).resolves.toEqual([]);
      });
    });

    describe('fetchForkBranchFileList', () => {
      test('compares the fork branch with the configured branch', async () => {
        vi.mocked(fetchAPI).mockResolvedValue({
          files: [
            { filename: 'content/posts/hello.md', status: 'modified' },
            { filename: 'content/posts/old.md', status: 'removed' },
            {
              filename: 'content/posts/new.md',
              status: 'renamed',
              previous_filename: 'content/posts/older.md',
            },
          ],
        });

        const pullRequest = /** @type {any} */ ({ branch: 'cms/contributor/repo/posts/hello' });

        await fetchForkBranchFileList(pullRequest);

        expect(fetchAPI).toHaveBeenCalledWith(
          '/repos/owner/repo/compare/main...contributor:cms/contributor/repo/posts/hello' +
            '?per_page=100',
        );

        expect(pullRequest.files).toEqual([
          {
            path: 'content/posts/hello.md',
            sha: '',
            size: 0,
            deleted: false,
            previousPath: undefined,
          },
          {
            path: 'content/posts/old.md',
            sha: '',
            size: 0,
            deleted: true,
            previousPath: undefined,
          },
          {
            path: 'content/posts/new.md',
            sha: '',
            size: 0,
            deleted: false,
            previousPath: 'content/posts/older.md',
          },
        ]);
      });

      test('copes with a comparison that reports no files', async () => {
        vi.mocked(fetchAPI).mockResolvedValue({});

        const pullRequest = /** @type {any} */ ({ branch: 'cms/contributor/repo/posts/hello' });

        await fetchForkBranchFileList(pullRequest);
        expect(pullRequest.files).toEqual([]);
      });
    });

    describe('fetchForkPullRequests', () => {
      test('compares only the branches an open pull request didn’t account for', async () => {
        vi.mocked(fetchGraphQL).mockImplementation(async (query) => {
          if (query.includes('refs(')) {
            return {
              repository: {
                refs: {
                  nodes: [createRefNode(), createRefNode({ name: 'posts/draft' })],
                },
              },
            };
          }

          if (query.includes('headRefName')) {
            // The first branch is in review; the second is a draft with no pull request
            return { repository: { pr_0: { nodes: [createBranchPullRequest()] }, pr_1: {} } };
          }

          return {
            repository: {
              file_0: { oid: 'sha', byteSize: 7, text: '# Hello' },
              file_1: { oid: 'sha2', byteSize: 7, text: '# Draft' },
            },
          };
        });

        vi.mocked(fetchAPI).mockResolvedValue({
          files: [{ filename: 'content/posts/draft.md', status: 'added' }],
        });

        const result = await fetchForkPullRequests();

        // Only the draft is compared; the entry in review is spared the request and its diff
        expect(fetchAPI).toHaveBeenCalledTimes(1);
        expect(fetchAPI).toHaveBeenCalledWith(
          expect.stringContaining('/compare/main...contributor:cms/contributor/repo/posts/draft'),
        );

        expect(result).toHaveLength(2);
      });

      test('looks up the previous path of a file a pull request renamed', async () => {
        vi.mocked(fetchGraphQL).mockImplementation(async (query) => {
          if (query.includes('refs(')) {
            return { repository: { refs: { nodes: [createRefNode()] } } };
          }

          if (query.includes('headRefName')) {
            return {
              repository: {
                pr_0: {
                  nodes: [
                    createBranchPullRequest({
                      files: { nodes: [{ path: 'content/posts/new.md', changeType: 'RENAMED' }] },
                    }),
                  ],
                },
              },
            };
          }

          return { repository: { file_0: { oid: 'sha', byteSize: 7, text: '# Hello' } } };
        });

        // The pull request’s own file list has no previous path, so the REST request fills it in
        vi.mocked(fetchAPI).mockResolvedValue([
          {
            filename: 'content/posts/new.md',
            status: 'renamed',
            previous_filename: 'content/posts/old.md',
          },
        ]);

        const result = await fetchForkPullRequests();

        expect(fetchAPI).toHaveBeenCalledWith(
          expect.stringContaining('/repos/owner/repo/pulls/1/files'),
        );

        expect(result[0].files[0].previousPath).toBe('content/posts/old.md');
      });

      test('drops a branch that no longer differs from the configured branch', async () => {
        vi.mocked(fetchGraphQL).mockImplementation(async (query) => {
          if (query.includes('refs(')) {
            return {
              repository: {
                refs: { nodes: [createRefNode(), createRefNode({ name: 'posts/stale' })] },
              },
            };
          }

          if (query.includes('headRefName')) {
            return { repository: {} };
          }

          return { repository: { file_0: { oid: 'sha', byteSize: 7, text: '# Hello' } } };
        });

        vi.mocked(fetchAPI).mockImplementation(async (path) =>
          path.includes('posts/stale')
            ? { files: [] }
            : { files: [{ filename: 'content/posts/hello.md', status: 'added' }] },
        );

        const result = await fetchForkPullRequests();

        expect(result).toHaveLength(1);
        expect(result[0].files[0].text).toBe('# Hello');
      });
    });

    describe('fetchPullRequests', () => {
      test('lists the fork’s branches rather than the labelled pull requests', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({ repository: { refs: { nodes: [] } } });

        await fetchPullRequests();

        expect(fetchGraphQL).toHaveBeenCalledWith(
          expect.stringContaining('refs('),
          expect.any(Object),
        );
      });
    });

    describe('createBranch', () => {
      test('creates the branch in the fork, from the configured repository’s head', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({
          fork: { id: 'R_fork' },
          base: { ref: { target: { oid: 'upstream-head' } } },
        });
        vi.mocked(fetchAPI).mockResolvedValue({ data: { createRef: { ref: { name: 'x' } } } });

        await expect(createBranch('cms/contributor/repo/posts/hello')).resolves.toBe(
          'upstream-head',
        );

        // Only the fork is named explicitly; the configured repository comes from the shared
        // GraphQL variables
        expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('query'), {
          forkOwner: 'contributor',
          forkRepo: 'repo',
        });

        // The branch goes in the fork but starts from the head upstream, so a fork that has
        // drifted doesn’t pass its own commits on
        expect(fetchAPI).toHaveBeenCalledWith(
          '',
          expect.objectContaining({
            body: expect.objectContaining({
              variables: {
                input: expect.objectContaining({ repositoryId: 'R_fork', oid: 'upstream-head' }),
              },
            }),
          }),
        );
      });
    });

    describe('deleteBranch', () => {
      test('deletes the branch from the fork', async () => {
        await deleteBranch('cms/contributor/repo/posts/hello');

        expect(fetchAPI).toHaveBeenCalledWith(
          '/repos/contributor/repo/git/refs/heads/cms/contributor/repo/posts/hello',
          expect.objectContaining({ method: 'DELETE' }),
        );
      });
    });

    describe('createPullRequest', () => {
      test('opens a cross-repository pull request without labelling it', async () => {
        vi.mocked(fetchAPI).mockResolvedValue({
          number: 5,
          node_id: 'PR_5',
          title: 'Create Post “hello”',
          html_url: 'https://github.com/owner/repo/pull/5',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        });

        await createPullRequest({
          branch: 'cms/contributor/repo/posts/hello',
          title: 'Create Post “hello”',
          status: 'pending_review',
        });

        expect(fetchAPI).toHaveBeenCalledWith('/repos/owner/repo/pulls', {
          method: 'POST',
          body: expect.objectContaining({
            head: 'contributor:cms/contributor/repo/posts/hello',
            base: 'main',
            draft: false,
          }),
        });

        // Labelling needs write access to the configured repository, which a contributor lacks
        expect(fetchAPI).toHaveBeenCalledTimes(1);
      });
    });

    describe('savePullRequest', () => {
      const args = /** @type {any} */ ({
        changes: [],
        options: { commitType: 'create' },
        branch: 'cms/contributor/repo/posts/hello',
        title: 'Create Post “hello”',
      });

      test('leaves a draft as a branch, with no pull request', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({
          fork: { id: 'R_fork' },
          base: { ref: { target: { oid: 'abc' } } },
        });
        vi.mocked(commitChanges).mockResolvedValue({
          sha: 'def',
          date: new Date('2026-01-03T00:00:00Z'),
          files: {},
        });
        vi.mocked(fetchAPI).mockResolvedValue({ data: { createRef: { ref: { name: 'x' } } } });

        const { pullRequest } = await savePullRequest({ ...args, status: 'draft' });

        expect(pullRequest).toEqual({
          title: 'Create Post “hello”',
          branch: 'cms/contributor/repo/posts/hello',
          status: 'draft',
          createdDate: new Date('2026-01-03T00:00:00Z'),
          updatedDate: new Date('2026-01-03T00:00:00Z'),
          files: [],
        });

        // Only the `createRef` mutation; no pull request was opened
        expect(fetchAPI).toHaveBeenCalledTimes(1);
      });

      test('opens the pull request right away for a removal', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({
          fork: { id: 'R_fork' },
          base: { ref: { target: { oid: 'abc' } } },
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
          });

        const { pullRequest } = await savePullRequest({ ...args, status: 'pending_deletion' });

        expect(pullRequest).toEqual(
          expect.objectContaining({ number: 5, status: 'pending_deletion' }),
        );
      });
    });

    describe('updateForkStatus', () => {
      test('refuses to mark an entry ready to publish', async () => {
        await expect(
          updateForkStatus(/** @type {any} */ ({ branch: 'b' }), 'pending_publish'),
        ).rejects.toThrow('Cannot mark an entry ready to publish');
      });

      test('opens the pull request when the draft is handed over for review', async () => {
        vi.mocked(fetchAPI).mockResolvedValue({
          number: 5,
          node_id: 'PR_5',
          title: 'x',
          html_url: 'u',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        });

        const result = await updateForkStatus(
          /** @type {any} */ ({ branch: 'cms/contributor/repo/posts/hello', title: 'x' }),
          'pending_review',
        );

        expect(result).toEqual(expect.objectContaining({ number: 5, status: 'pending_review' }));
      });

      test('leaves a branch-only draft alone', async () => {
        const pullRequest = /** @type {any} */ ({
          branch: 'cms/contributor/repo/posts/hello',
          title: 'x',
          status: 'draft',
        });

        const result = await updateForkStatus(pullRequest, 'draft');

        expect(result.status).toBe('draft');
        expect(fetchAPI).not.toHaveBeenCalled();
      });

      test('converts an open pull request to a draft', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({ node: { state: 'OPEN', isDraft: false } });

        await updateForkStatus(
          /** @type {any} */ ({ nodeId: 'PR_1', number: 1, branch: 'b', title: 'x' }),
          'draft',
        );

        expect(fetchGraphQL).toHaveBeenLastCalledWith(
          expect.stringContaining('convertPullRequestToDraft'),
          { input: { pullRequestId: 'PR_1' } },
        );
      });

      test('leaves a pull request that is already a draft alone', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({ node: { state: 'OPEN', isDraft: true } });

        await updateForkStatus(
          /** @type {any} */ ({ nodeId: 'PR_1', number: 1, branch: 'b', title: 'x' }),
          'draft',
        );

        expect(fetchGraphQL).toHaveBeenCalledTimes(1);
      });

      test('reopens a closed pull request and marks it ready for review', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({ node: { state: 'CLOSED', isDraft: true } });

        await updateForkStatus(
          /** @type {any} */ ({ nodeId: 'PR_1', number: 1, branch: 'b', title: 'x' }),
          'pending_review',
        );

        expect(fetchAPI).toHaveBeenCalledWith('/repos/owner/repo/pulls/1', {
          method: 'PATCH',
          body: { state: 'open' },
        });

        expect(fetchGraphQL).toHaveBeenLastCalledWith(
          expect.stringContaining('markPullRequestReadyForReview'),
          { input: { pullRequestId: 'PR_1' } },
        );
      });

      test('copes with a pull request that can no longer be read', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({});

        const result = await updateForkStatus(
          /** @type {any} */ ({ nodeId: 'PR_1', number: 1, branch: 'b', title: 'x' }),
          'pending_review',
        );

        expect(result.status).toBe('pending_review');
      });
    });

    describe('updateStatus', () => {
      test('takes the fork path rather than updating labels', async () => {
        vi.mocked(fetchGraphQL).mockResolvedValue({ node: { state: 'OPEN', isDraft: false } });

        await updateStatus(
          /** @type {any} */ ({ nodeId: 'PR_1', number: 1, branch: 'b', title: 'x' }),
          'draft',
        );

        // The labels endpoint is never touched
        expect(fetchAPI).not.toHaveBeenCalled();
      });
    });

    describe('reopenPullRequest', () => {
      test('reopens the pull request on the configured repository', async () => {
        await reopenPullRequest(/** @type {any} */ ({ number: 7 }));

        expect(fetchAPI).toHaveBeenCalledWith('/repos/owner/repo/pulls/7', {
          method: 'PATCH',
          body: { state: 'open' },
        });
      });
    });

    describe('publish', () => {
      test('refuses to merge', async () => {
        await expect(
          publish(/** @type {any} */ ({ number: 1, branch: 'b', title: 'x' })),
        ).rejects.toThrow('Cannot publish as an Open Authoring contributor');
      });
    });

    describe('discard', () => {
      test('deletes a branch-only draft without closing anything', async () => {
        await discard(/** @type {any} */ ({ branch: 'cms/contributor/repo/posts/hello' }));

        expect(fetchAPI).toHaveBeenCalledTimes(1);
        expect(fetchAPI).toHaveBeenCalledWith(
          '/repos/contributor/repo/git/refs/heads/cms/contributor/repo/posts/hello',
          expect.objectContaining({ method: 'DELETE' }),
        );
      });

      test('closes the pull request when there is one', async () => {
        await discard(
          /** @type {any} */ ({ number: 1, branch: 'cms/contributor/repo/posts/hello' }),
        );

        expect(fetchAPI).toHaveBeenNthCalledWith(1, '/repos/owner/repo/pulls/1', {
          method: 'PATCH',
          body: { state: 'closed' },
        });
      });
    });
  });

  test('the repository info is used as the base branch', () => {
    expect(repository.branch).toBe('main');
  });
});
