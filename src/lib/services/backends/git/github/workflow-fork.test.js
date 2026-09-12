import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  fetchForkBranches,
  fetchForkBranchFileList,
  fetchForkBranchPullRequests,
  fetchForkPullRequests,
  parseForkBranch,
  updateForkStatus,
} from '$lib/services/backends/git/github/workflow-fork';
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

describe('GitHub Open Authoring workflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStores();
    vi.mocked(fetchAPI).mockResolvedValue({});
    vi.mocked(fetchGraphQL).mockResolvedValue({});
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
  });
});
