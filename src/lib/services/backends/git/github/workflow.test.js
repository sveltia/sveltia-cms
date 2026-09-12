import { beforeEach, describe, expect, test, vi } from 'vitest';

import { commitChanges } from '$lib/services/backends/git/github/commits';
import { repository } from '$lib/services/backends/git/github/repository';
import githubWorkflow, {
  createBranch,
  discard,
  fetchPullRequests,
  parsePullRequest,
  publish,
  savePullRequest,
  updateStatus,
} from '$lib/services/backends/git/github/workflow';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

vi.mock('$lib/services/backends/git/github/commits');
vi.mock('$lib/services/backends/git/github/files');
vi.mock('$lib/services/backends/git/github/repository', () => ({
  repository: { owner: 'owner', repo: 'repo', branch: 'main' },
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

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
 * Stub the state read across the workflow service: the site configuration, and the Open Authoring
 * state that decides which of the two flows a call takes.
 * @param {object} [args] Arguments.
 * @param {object | null} [args.backend] Backend configuration, or `null` for no configuration at
 * all. It can’t be `undefined`, which the parameter default would replace.
 * @param {{ owner: string, repo: string }} [args.fork] Fork the contributor writes to, which turns
 * the Open Authoring flow on.
 */
const mockStores = ({ backend = { name: 'github' }, fork = undefined } = {}) => {
  forkedRepository.current = /** @type {any} */ (fork);
  cmsConfig.current = /** @type {any} */ (backend ? { backend } : undefined);
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

    // A GraphQL error comes back as a rejection carrying the message, not as a resolved response
    // with an `errors` key
    const alreadyExists = new Error('Server responded with an error', {
      cause: {
        status: 200,
        message: 'A ref named "refs/heads/cms/posts/hello" already exists in the repository.',
      },
    });

    /**
     * Mock the base query, then the open pull request count for an existing branch.
     * @param {number} totalCount Number of open pull requests from the branch.
     */
    const mockExisting = (totalCount) => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({ fork: { id: 'R_1' }, base: { ref: { target: { oid: 'abc' } } } })
        .mockResolvedValueOnce({ repository: { pullRequests: { totalCount } } });
    };

    test('resets an existing reference that has no open pull request', async () => {
      mockExisting(0);
      vi.mocked(fetchAPI).mockRejectedValueOnce(alreadyExists).mockResolvedValueOnce({});

      // The branch is left behind by an earlier pull request for the same entry — one merged
      // without deleting the branch, or closed on GitHub rather than discarded in the CMS. Starting
      // from it as it stands would carry that work into the new pull request, so it starts over
      // from the configured branch instead, and the head is known like a fresh branch’s
      await expect(createBranch('cms/posts/hello')).resolves.toBe('abc');

      expect(fetchGraphQL).toHaveBeenLastCalledWith(expect.stringContaining('pullRequests'), {
        owner: 'owner',
        repo: 'repo',
        branch: 'cms/posts/hello',
      });
      expect(fetchAPI).toHaveBeenLastCalledWith(
        '/repos/owner/repo/git/refs/heads/cms/posts/hello',
        {
          method: 'PATCH',
          body: { sha: 'abc', force: true },
        },
      );
    });

    test('keeps an existing reference that has an open pull request', async () => {
      mockExisting(1);
      vi.mocked(fetchAPI).mockRejectedValueOnce(alreadyExists);

      // The load didn’t pick the pull request up — its label is gone, or it’s beyond the number
      // fetched — but it’s someone’s work in progress, which is committed onto rather than wiped
      await expect(createBranch('cms/posts/hello')).resolves.toBeUndefined();

      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });

    test('keeps an existing reference with Open Authoring', async () => {
      mockStores({ fork: { owner: 'contributor', repo: 'repo' } });
      mockBase();
      vi.mocked(fetchAPI).mockRejectedValueOnce(alreadyExists);

      // A draft is a branch without a pull request, so a leftover can’t be told from a live one
      await expect(createBranch('cms/posts/hello')).resolves.toBeUndefined();

      expect(fetchGraphQL).toHaveBeenCalledTimes(1);
      expect(fetchAPI).toHaveBeenCalledTimes(1);
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

    test('starts over from the base head when the branch was left over', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({ fork: { id: 'R_1' }, base: { ref: { target: { oid: 'abc' } } } })
        .mockResolvedValueOnce({ repository: { pullRequests: { totalCount: 0 } } });
      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });
      vi.mocked(fetchAPI).mockRejectedValueOnce(
        new Error('Server responded with an error', {
          cause: { status: 200, message: 'already exists' },
        }),
      );

      await savePullRequest(args).catch(() => undefined);

      // A branch left by an interrupted save, or by a pull request closed outside the CMS, is
      // reset to the base head, so the commit knows where it goes without looking the head up
      expect(commitChanges).toHaveBeenCalledWith([], expect.objectContaining({ headOid: 'abc' }));
    });

    test('looks the head up when the branch has an open pull request the load missed', async () => {
      vi.mocked(fetchGraphQL)
        .mockResolvedValueOnce({ fork: { id: 'R_1' }, base: { ref: { target: { oid: 'abc' } } } })
        .mockResolvedValueOnce({ repository: { pullRequests: { totalCount: 1 } } });
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

    beforeEach(() => {
      mockStores({ fork });
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
