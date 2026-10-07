import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  createPullRequest,
  deleteBranch,
  fetchAllPages,
  fetchBranchHead,
  fetchPullRequestFileContents,
  fetchPullRequestFileList,
  fetchPullRequestHeadRef,
  updateDraftState,
} from '$lib/services/backends/git/gitea/pull-requests';
import {
  fetchForkBranchFileList,
  fetchForkBranchList,
  fetchForkPullRequestMap,
  fetchForkPullRequests,
  isForkPullRequest,
  parseForkBranch,
  reopenPullRequest,
  updateForkStatus,
} from '$lib/services/backends/git/gitea/workflow-fork';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { user } from '$lib/services/user/account.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key) }));
// Only the requests are stubbed; `stripWipPrefix` is a pure helper the parsing relies on
vi.mock('$lib/services/backends/git/gitea/pull-requests', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  createPullRequest: vi.fn(),
  deleteBranch: vi.fn(),
  fetchAllPages: vi.fn(),
  fetchBranchHead: vi.fn(),
  fetchPullRequestFileContents: vi.fn(),
  fetchPullRequestFileList: vi.fn(),
  fetchPullRequestHeadRef: vi.fn(),
  updateDraftState: vi.fn(),
}));
vi.mock('$lib/services/backends/git/gitea/repository', () => ({
  repository: { owner: 'owner', repo: 'repo', branch: 'main' },
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/user/account.svelte', () => ({ user: { account: undefined } }));

const BRANCH = 'cms/me/repo/posts/hello';

/**
 * Create a raw branch as returned by the REST API.
 * @param {object} [overrides] Properties to override.
 * @returns {any} Branch.
 */
const createBranch = (overrides = {}) => ({
  name: BRANCH,
  commit: {
    id: 'head1',
    message: 'Create Post “hello”',
    timestamp: '2026-01-01T00:00:00Z',
    author: { name: 'Me', email: 'me@example.com', username: 'me' },
  },
  ...overrides,
});

/**
 * Create a raw pull request as returned by the REST API.
 * @param {object} [overrides] Properties to override.
 * @returns {any} Pull request.
 */
const createItem = (overrides = {}) => ({
  id: 900,
  number: 7,
  title: 'Create Post “hello”',
  html_url: 'https://gitea.com/owner/repo/pulls/7',
  state: 'open',
  draft: false,
  merged: false,
  head: { ref: BRANCH, sha: 'head1', repo: { full_name: 'me/repo' } },
  base: { ref: 'main' },
  user: { id: 5, login: 'me' },
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-03T00:00:00Z',
  ...overrides,
});

describe('Gitea Open Authoring workflow service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    forkedRepository.current = { owner: 'me', repo: 'repo' };
    user.account = /** @type {any} */ ({ backendName: 'gitea', id: 5, login: 'me' });
    vi.mocked(fetchAPI).mockResolvedValue([]);
    // The lists come through the paginating helper, which is mocked along with the rest of the
    // module; it hands back whatever the API mock answers for the path
    vi.mocked(fetchAllPages).mockImplementation(
      async (path) => /** @type {any} */ (await fetchAPI(path)),
    );
  });

  describe('fetchForkBranchList', () => {
    test('lists the branches in the fork that carry the workflow prefix', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([
        createBranch({ name: 'main' }),
        createBranch(),
        createBranch({ name: 'cms/other/repo/posts/x' }),
      ]);

      const result = await fetchForkBranchList();

      expect(fetchAllPages).toHaveBeenCalledWith('/repos/me/repo/branches');
      expect(result.map(({ name }) => name)).toEqual([BRANCH]);
    });
  });

  describe('isForkPullRequest', () => {
    test('accepts the contributor’s own pull request from the fork to the configured branch', () => {
      expect(isForkPullRequest(createItem())).toBe(true);
    });

    test.each([
      [
        'comes from the configured repository',
        { head: { ref: BRANCH, repo: { full_name: 'owner/repo' } } },
      ],
      ['comes from a deleted repository', { head: { ref: BRANCH } }],
      ['goes to another branch', { base: { ref: 'develop' } }],
      ['was opened by someone else', { user: { id: 6, login: 'other' } }],
      ['names no author', { user: undefined }],
    ])('rejects a pull request that %s', (_label, overrides) => {
      expect(isForkPullRequest(createItem(overrides))).toBe(false);
    });

    test('rejects any pull request without a fork or a user on record', () => {
      forkedRepository.current = undefined;
      expect(isForkPullRequest(createItem())).toBe(false);

      forkedRepository.current = { owner: 'me', repo: 'repo' };
      user.account = undefined;
      expect(isForkPullRequest(createItem({ user: { id: undefined } }))).toBe(false);
    });
  });

  describe('fetchForkPullRequestMap', () => {
    test('maps the contributor’s pull requests by head branch', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([
        // The most recently updated comes first
        createItem({ number: 9, state: 'closed', updated_at: '2026-01-05T00:00:00Z' }),
        createItem({ number: 8, state: 'open', updated_at: '2026-01-04T00:00:00Z' }),
        // A pull request from a branch of the same name on the configured repository
        createItem({ number: 3, head: { ref: BRANCH, repo: { full_name: 'owner/repo' } } }),
        createItem({
          number: 2,
          head: { ref: 'cms/me/repo/posts/b', repo: { full_name: 'ME/REPO' } },
        }),
        // Aimed at another branch since, or opened by someone else from the contributor’s branch
        createItem({ number: 10, base: { ref: 'develop' }, updated_at: '2026-01-06T00:00:00Z' }),
        createItem({ number: 11, user: { id: 6 }, updated_at: '2026-01-06T00:00:00Z' }),
      ]);

      const map = await fetchForkPullRequestMap();

      expect(fetchAllPages).toHaveBeenCalledWith(
        '/repos/owner/repo/pulls?state=all&sort=recentupdate&poster=me',
      );

      // An open pull request wins over a closed one updated more recently
      expect(map.get(BRANCH)?.number).toBe(8);
      // Matching the fork is case-insensitive, like the instance
      expect(map.get('cms/me/repo/posts/b')?.number).toBe(2);
      expect(map.size).toBe(2);
    });

    test('keeps the most recently updated one otherwise', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([
        createItem({ number: 9, state: 'closed' }),
        createItem({ number: 8, state: 'closed' }),
      ]);

      const map = await fetchForkPullRequestMap();

      expect(map.get(BRANCH)?.number).toBe(9);
    });
  });

  describe('parseForkBranch', () => {
    test('parses a draft branch that has no pull request', () => {
      expect(parseForkBranch(createBranch())).toEqual({
        number: undefined,
        nodeId: undefined,
        title: 'Create Post “hello”',
        url: undefined,
        branch: BRANCH,
        headSHA: 'head1',
        status: 'draft',
        createdDate: new Date('2026-01-01T00:00:00Z'),
        updatedDate: new Date('2026-01-01T00:00:00Z'),
        author: { name: 'Me', email: 'me@example.com', login: 'me' },
        files: [],
        canMerge: false,
      });
    });

    test('takes the stage from an open pull request', () => {
      expect(parseForkBranch(createBranch(), createItem())).toEqual(
        expect.objectContaining({
          number: 7,
          nodeId: '900',
          title: 'Create Post “hello”',
          url: 'https://gitea.com/owner/repo/pulls/7',
          status: 'pending_review',
          createdDate: new Date('2026-01-02T00:00:00Z'),
          updatedDate: new Date('2026-01-03T00:00:00Z'),
        }),
      );

      // A work in progress is still a draft
      expect(parseForkBranch(createBranch(), createItem({ draft: true })).status).toBe('draft');
    });

    test('keeps a closed pull request as a draft, and forgets a merged one', () => {
      const closed = parseForkBranch(createBranch(), createItem({ state: 'closed' }));

      expect(closed.status).toBe('draft');
      expect(closed.number).toBe(7);

      const merged = parseForkBranch(createBranch(), createItem({ state: 'closed', merged: true }));

      expect(merged.status).toBe('draft');
      expect(merged.number).toBeUndefined();
    });

    test('drops the work-in-progress prefix from the title', () => {
      // Keeping it would be written straight back when the entry leaves the drafting stage, so the
      // pull request would stay a work in progress and the card would bounce back to Draft
      const result = parseForkBranch(
        createBranch(),
        createItem({ draft: true, title: 'WIP: Create Post “hello”' }),
      );

      expect(result.title).toBe('Create Post “hello”');
      expect(result.status).toBe('draft');
    });

    test('copes with a branch whose commit is missing details', () => {
      const result = parseForkBranch(
        createBranch({ commit: { id: 'x', timestamp: '2026-01-01T00:00:00Z' } }),
      );

      expect(result.title).toBe('');
      expect(result.author).toBeUndefined();

      expect(
        parseForkBranch(
          createBranch({
            commit: { id: 'x', timestamp: '2026-01-01T00:00:00Z', author: { name: 'A' } },
          }),
        ).author,
      ).toEqual({ name: 'A', email: '', login: undefined });
    });
  });

  describe('fetchForkBranchFileList', () => {
    test('gathers the files touched by the commits since the configured branch', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        total_commits: 2,
        commits: [
          { files: [{ filename: 'content/posts/hello.md', status: 'added' }] },
          {
            files: [
              { filename: 'content/posts/hello.md', status: 'modified' },
              { filename: 'static/img.png', status: 'added' },
            ],
          },
          {},
        ],
      });

      const pullRequest = /** @type {any} */ ({ branch: BRANCH, files: [] });

      await fetchForkBranchFileList(pullRequest);

      expect(fetchAPI).toHaveBeenCalledWith(`/repos/me/repo/compare/main...${BRANCH}`);
      expect(pullRequest.files).toEqual([
        { path: 'content/posts/hello.md', sha: '', size: 0, deleted: false },
        { path: 'static/img.png', sha: '', size: 0, deleted: false },
      ]);
    });

    test('leaves the list empty when the branch doesn’t differ', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ total_commits: 0 });

      const pullRequest = /** @type {any} */ ({ branch: BRANCH, files: [] });

      await fetchForkBranchFileList(pullRequest);

      expect(pullRequest.files).toEqual([]);
    });
  });

  describe('fetchForkPullRequests', () => {
    test('returns nothing without a workflow branch', async () => {
      await expect(fetchForkPullRequests()).resolves.toEqual([]);
      expect(fetchAllPages).toHaveBeenCalledTimes(1);
    });

    test('completes each branch from its pull request or a comparison', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path.includes('/branches')) {
          return [createBranch(), createBranch({ name: 'cms/me/repo/posts/draft' })];
        }

        if (path.includes('/pulls?')) {
          return [createItem()];
        }

        return { commits: [{ files: [{ filename: 'content/posts/draft.md' }] }] };
      });

      vi.mocked(fetchPullRequestFileList).mockImplementation(async (pullRequest) => {
        pullRequest.files = [{ path: 'content/posts/hello.md', sha: '', size: 0, deleted: false }];
      });

      const result = await fetchForkPullRequests();

      expect(result.map(({ branch, status }) => [branch, status])).toEqual([
        [BRANCH, 'pending_review'],
        ['cms/me/repo/posts/draft', 'draft'],
      ]);

      // The open pull request reports its own files; the draft is compared with the configured
      // branch
      expect(fetchPullRequestFileList).toHaveBeenCalledTimes(1);
      expect(fetchAPI).toHaveBeenCalledWith(
        // The branch is compared as of its head commit, which the content is read at as well
        '/repos/me/repo/compare/main...head1',
      );
      expect(fetchPullRequestFileContents).toHaveBeenCalledTimes(2);
      expect(deleteBranch).not.toHaveBeenCalled();
    });

    test('tidies up a branch left behind by a merged pull request', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path.includes('/branches')) {
          return [createBranch(), createBranch({ name: 'cms/me/repo/posts/again' })];
        }

        if (path.includes('/pulls?')) {
          return [
            createItem({ state: 'closed', merged: true }),
            // Merged, but the branch has moved on since, so it’s a fresh draft
            // Forgejo reports the branch’s current head on a merged pull request too, which says
            // nothing about what was merged
            createItem({
              number: 8,
              state: 'closed',
              merged: true,
              head: {
                ref: 'cms/me/repo/posts/again',
                sha: 'head1',
                repo: { full_name: 'me/repo' },
              },
            }),
          ];
        }

        return { commits: [{ files: [{ filename: 'content/posts/again.md' }] }] };
      });

      // The commit each pull request was merged at
      vi.mocked(fetchPullRequestHeadRef).mockImplementation(async (number) =>
        number === 7 ? 'head1' : 'old',
      );

      const result = await fetchForkPullRequests();

      expect(fetchPullRequestHeadRef).toHaveBeenCalledTimes(2);
      expect(deleteBranch).toHaveBeenCalledTimes(1);
      expect(deleteBranch).toHaveBeenCalledWith(BRANCH);
      expect(result.map(({ branch, number }) => [branch, number])).toEqual([
        ['cms/me/repo/posts/again', undefined],
      ]);
    });

    test('drops a branch that holds nothing', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path.includes('/branches')) {
          return [createBranch()];
        }

        return path.includes('/pulls?') ? [] : { commits: [] };
      });

      await expect(fetchForkPullRequests()).resolves.toEqual([]);
    });
  });

  describe('reopenPullRequest', () => {
    test('reopens the pull request', async () => {
      await reopenPullRequest(/** @type {any} */ ({ number: 7 }));

      expect(fetchAPI).toHaveBeenCalledWith('/repos/owner/repo/pulls/7', {
        method: 'PATCH',
        body: { state: 'open' },
      });
    });
  });

  describe('updateForkStatus', () => {
    const draft = /** @type {any} */ ({ branch: BRANCH, title: 'T', status: 'draft' });
    const opened = /** @type {any} */ ({ ...draft, number: 7, nodeId: '900' });

    test('refuses the ready stage', async () => {
      await expect(updateForkStatus(draft, 'pending_publish')).rejects.toThrow(
        'Cannot mark an entry ready to publish',
      );
    });

    test('opens the pull request when a draft is sent for review', async () => {
      const created = /** @type {any} */ ({ ...opened, status: 'pending_review' });

      vi.mocked(createPullRequest).mockResolvedValue(created);

      await expect(updateForkStatus(draft, 'pending_review')).resolves.toBe(created);
      expect(createPullRequest).toHaveBeenCalledWith({
        branch: BRANCH,
        title: 'T',
        status: 'pending_review',
      });
    });

    test('leaves a draft without a pull request alone', async () => {
      const result = await updateForkStatus(draft, 'draft');

      expect(result.status).toBe('draft');
      expect(fetchAPI).not.toHaveBeenCalled();
      expect(createPullRequest).not.toHaveBeenCalled();
    });

    test('marks an open pull request as a work in progress when taken back to draft', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createItem());

      const result = await updateForkStatus({ ...opened, status: 'pending_review' }, 'draft');

      expect(fetchAPI).toHaveBeenCalledWith('/repos/owner/repo/pulls/7');
      expect(updateDraftState).toHaveBeenCalledWith(expect.objectContaining({ number: 7 }), true);
      expect(result.status).toBe('draft');
    });

    test('leaves a closed or already draft pull request as is when taken back to draft', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createItem({ state: 'closed' }));
      await updateForkStatus(opened, 'draft');

      vi.mocked(fetchAPI).mockResolvedValue(createItem({ draft: true }));
      await updateForkStatus(opened, 'draft');

      expect(updateDraftState).not.toHaveBeenCalled();
    });

    test('reopens and marks ready a closed work in progress sent for review', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createItem({ state: 'closed', draft: true }));

      const result = await updateForkStatus(opened, 'pending_review');

      expect(fetchAPI).toHaveBeenLastCalledWith('/repos/owner/repo/pulls/7', {
        method: 'PATCH',
        body: { state: 'open' },
      });
      expect(updateDraftState).toHaveBeenCalledWith(expect.objectContaining({ number: 7 }), false);
      expect(result.status).toBe('pending_review');
    });

    test('reports the entry published when the branch holds nothing since the merge', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createItem({ state: 'closed', merged: true }));
      vi.mocked(fetchPullRequestHeadRef).mockResolvedValue('head2');
      // The branch still points at the commit the pull request was merged at, whatever the pull
      // request says its head is
      vi.mocked(fetchBranchHead).mockResolvedValue('head2');

      await expect(updateForkStatus(opened, 'pending_review')).rejects.toThrow(
        'entry_already_published',
      );

      expect(fetchPullRequestHeadRef).toHaveBeenCalledWith(7);
      expect(fetchBranchHead).toHaveBeenCalledWith(BRANCH);
      expect(deleteBranch).toHaveBeenCalledWith(BRANCH);
      expect(createPullRequest).not.toHaveBeenCalled();
    });

    test('starts afresh when the branch has moved on since the merge', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createItem({ state: 'closed', merged: true }));
      vi.mocked(fetchPullRequestHeadRef).mockResolvedValue('head1');
      vi.mocked(fetchBranchHead).mockResolvedValue('head2');

      // Back to draft: the branch is what’s left, without the pull request
      const result = await updateForkStatus({ ...opened, status: 'pending_review' }, 'draft');

      expect(result).toEqual(
        expect.objectContaining({
          number: undefined,
          nodeId: undefined,
          url: undefined,
          status: 'draft',
        }),
      );
      // The instance refuses to change the state of a merged pull request, so nothing is patched
      expect(fetchAPI).toHaveBeenCalledTimes(1);
      expect(updateDraftState).not.toHaveBeenCalled();
      expect(deleteBranch).not.toHaveBeenCalled();

      // Sent for review again: a new pull request is opened for the fresh commits
      const created = /** @type {any} */ ({ ...opened, number: 9, status: 'pending_review' });

      vi.mocked(createPullRequest).mockResolvedValue(created);

      await expect(updateForkStatus(opened, 'pending_review')).resolves.toBe(created);
      expect(createPullRequest).toHaveBeenCalledWith({
        branch: BRANCH,
        title: 'T',
        status: 'pending_review',
      });
      expect(fetchAPI).not.toHaveBeenCalledWith(expect.anything(), expect.anything());
    });

    test('starts afresh when the merged pull request has no reference to go by', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createItem({ state: 'closed', merged: true }));
      vi.mocked(fetchPullRequestHeadRef).mockResolvedValue(undefined);
      vi.mocked(fetchBranchHead).mockResolvedValue('head1');

      const result = await updateForkStatus(opened, 'draft');

      expect(result.number).toBeUndefined();
      expect(deleteBranch).not.toHaveBeenCalled();
    });

    test.each([
      ['aimed at another branch since', { base: { ref: 'develop' } }],
      ['opened by someone else', { user: { id: 6, login: 'other' } }],
      ['merged, but not the entry’s', { merged: true, state: 'closed', base: { ref: 'develop' } }],
    ])('leaves a pull request %s alone and starts afresh', async (_label, overrides) => {
      vi.mocked(fetchAPI).mockResolvedValue(
        createItem({ state: 'closed', draft: true, ...overrides }),
      );

      const created = /** @type {any} */ ({ ...opened, number: 9, status: 'pending_review' });

      vi.mocked(createPullRequest).mockResolvedValue(created);

      // Reopening it or taking it out of the work-in-progress state would put someone else’s
      // request, or one for another branch, in front of the maintainers
      await expect(updateForkStatus(opened, 'pending_review')).resolves.toBe(created);

      expect(fetchAPI).toHaveBeenCalledTimes(1);
      expect(updateDraftState).not.toHaveBeenCalled();
      expect(fetchBranchHead).not.toHaveBeenCalled();
    });

    test('needs no request for an open pull request already ready for review', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createItem());

      await updateForkStatus(opened, 'pending_review');

      expect(fetchAPI).toHaveBeenCalledTimes(1);
      expect(updateDraftState).not.toHaveBeenCalled();
    });
  });
});
