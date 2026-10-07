import { beforeEach, describe, expect, test, vi } from 'vitest';

import { commitChanges } from '$lib/services/backends/git/gitea/commits';
import { resetPageSize } from '$lib/services/backends/git/gitea/pull-requests';
import giteaWorkflow, {
  discard,
  fetchLabelledPullRequests,
  fetchMergeState,
  fetchPullRequests,
  fetchUnchangedPaths,
  publish,
  savePullRequest,
  updateStatus,
} from '$lib/services/backends/git/gitea/workflow';
import {
  fetchForkPullRequests,
  updateForkStatus,
} from '$lib/services/backends/git/gitea/workflow-fork';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key, { values } = {}) => (values ? `${key} ${JSON.stringify(values)}` : key)),
}));
vi.mock('$lib/services/backends/git/gitea/commits');
vi.mock('$lib/services/backends/git/gitea/files');
vi.mock('$lib/services/backends/git/gitea/repository', () => ({
  repository: { owner: 'owner', repo: 'repo', branch: 'main' },
}));
vi.mock('$lib/services/backends/git/gitea/workflow-fork');
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

const REPO_PATH = '/repos/owner/repo';
/**
 * Encode the given text as Base64, the way an instance returns file contents.
 * @param {string} text Plain text.
 * @returns {string} Base64.
 */
const toBase64 = (text) => new TextEncoder().encode(text).toBase64();
/**
 * Get the request body passed to the given `fetchAPI` call.
 * @param {number} [index] Call index.
 * @returns {any} Request body.
 */
const getRequestBody = (index = 0) => vi.mocked(fetchAPI).mock.calls[index][1]?.body;

/**
 * Create a raw pull request as returned by the REST API.
 * @param {object} [overrides] Properties to override.
 * @returns {any} Pull request.
 */
const createItem = (overrides = {}) => ({
  id: 900,
  number: 1,
  title: 'WIP: Create Post “hello”',
  html_url: 'https://gitea.com/owner/repo/pulls/1',
  head: { ref: 'cms/posts/hello', sha: 'abc123', repo_id: 1, repo: { full_name: 'owner/repo' } },
  base: { ref: 'main', repo_id: 1, repo: { full_name: 'owner/repo' } },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  user: { id: 7, login: 'me', full_name: 'Me', email: 'me@example.com' },
  labels: [{ name: 'sveltia-cms/draft' }],
  ...overrides,
});

describe('Gitea Editorial Workflow service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetPageSize();
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitea' } });
    forkedRepository.current = undefined;
    vi.mocked(fetchAPI).mockResolvedValue({});
  });

  test('exports the expected service structure', () => {
    expect(giteaWorkflow).toEqual({
      fetchPullRequests: expect.any(Function),
      savePullRequest: expect.any(Function),
      updateStatus: expect.any(Function),
      fetchBranchHead: expect.any(Function),
      fetchMergeState: expect.any(Function),
      fetchUnchangedPaths: expect.any(Function),
      publish: expect.any(Function),
      discard: expect.any(Function),
    });
  });

  describe('fetchLabelledPullRequests', () => {
    /** Labels defined on the repository, the status ones among others. */
    const LABELS = [
      { id: 11, name: 'sveltia-cms/draft' },
      { id: 12, name: 'bug' },
      { id: 13, name: 'decap-cms/pending_publish' },
    ];

    /**
     * Mock the REST API, returning the given labels, pull request list and pull requests.
     * @param {object} args Arguments.
     * @param {any[]} [args.labels] Labels defined on the repository.
     * @param {any[]} args.list Items returned by the pull request list.
     * @param {Record<number, any>} args.pulls Pull requests keyed by number.
     */
    const mockList = ({ labels = LABELS, list, pulls }) => {
      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path === '/settings/api') {
          return { max_response_items: 50 };
        }

        if (path.includes('/labels?')) {
          return labels;
        }

        if (path.includes('/pulls?')) {
          return list;
        }

        if (path.includes('/files?')) {
          return [
            {
              filename: 'content/posts/hello.md',
              status: 'changed',
              contents_url: `https://gitea.com/api/v1${REPO_PATH}/contents/x?ref=abc123`,
            },
          ];
        }

        if (path.includes('/contents/')) {
          return { sha: 'sha1', size: 7, content: toBase64('# Hello'), encoding: 'base64' };
        }

        const [, number] = path.match(/\/pulls\/(\d+)$/) ?? [];

        return pulls[Number(number)];
      });
    };

    test('lists the pull requests carrying any of the status labels by their IDs', async () => {
      mockList({ list: [{ number: 1 }], pulls: { 1: createItem() } });

      const result = await fetchLabelledPullRequests();

      // The issue endpoint would take the names, but only match an item carrying all of them
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/labels?page=1&limit=50`);
      expect(fetchAPI).toHaveBeenCalledWith(
        `${REPO_PATH}/pulls?state=open&sort=recentupdate&labels=11&labels=13&page=1&limit=50`,
      );

      expect(result).toHaveLength(1);
      expect(result[0].files[0].text).toBe('# Hello');
    });

    test('reads each pull request once, however many status labels it carries', async () => {
      mockList({ list: [{ number: 1 }, { number: 1 }], pulls: { 1: createItem() } });

      await expect(fetchLabelledPullRequests()).resolves.toHaveLength(1);
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/pulls/1`);
      expect(
        vi.mocked(fetchAPI).mock.calls.filter(([path]) => path === `${REPO_PATH}/pulls/1`),
      ).toHaveLength(1);
    });

    test('lists nothing when the repository has no status label yet', async () => {
      mockList({ labels: [{ id: 12, name: 'bug' }], list: [], pulls: {} });

      await expect(fetchLabelledPullRequests()).resolves.toEqual([]);
      // The page size, then the labels; no pull request is listed
      expect(fetchAPI).toHaveBeenCalledTimes(2);
    });

    test('skips a pull request that turns out not to be manageable', async () => {
      mockList({
        list: [{ number: 1 }, { number: 2 }],
        pulls: {
          1: createItem({ head: { ref: 'cms/posts/hello', repo_id: 2 } }),
          // The label was removed since the list was read
          2: createItem({ number: 2, labels: [{ name: 'bug' }] }),
        },
      });

      await expect(fetchLabelledPullRequests()).resolves.toEqual([]);
    });

    test('sorts the pull requests by the last update, newest first', async () => {
      mockList({
        list: [{ number: 1 }, { number: 2 }],
        pulls: {
          1: createItem(),
          2: createItem({
            id: 901,
            number: 2,
            labels: [{ name: 'decap-cms/pending_publish' }],
            updated_at: '2026-01-03T00:00:00Z',
          }),
        },
      });

      const result = await fetchLabelledPullRequests();

      expect(result.map(({ number }) => number)).toEqual([2, 1]);
    });
  });

  describe('savePullRequest', () => {
    const args = /** @type {any} */ ({
      changes: [],
      options: { commitType: 'create' },
      branch: 'cms/posts/hello',
      title: 'Create Post “hello”',
      status: 'draft',
    });

    test('lets the commit create the branch on the first save', async () => {
      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });

      vi.mocked(fetchAPI).mockImplementation(async (path) =>
        path.endsWith('/labels')
          ? [{ name: 'sveltia-cms/draft' }]
          : {
              id: 900,
              number: 5,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
      );

      const result = await savePullRequest(args);

      expect(commitChanges).toHaveBeenCalledWith([], {
        commitType: 'create',
        branch: 'cms/posts/hello',
        startBranch: 'main',
      });

      expect(result.pullRequest.number).toBe(5);
    });

    test('reads the SHAs from the configured branch before it exists', async () => {
      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });

      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path.includes('/contents/')) {
          return { sha: 'main-sha' };
        }

        if (path.endsWith('/labels')) {
          return [{ name: 'sveltia-cms/draft' }];
        }

        return {
          id: 900,
          number: 5,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        };
      });

      await savePullRequest({
        ...args,
        changes: [{ action: 'delete', path: 'content/posts/hello.md' }],
      });

      expect(fetchAPI).toHaveBeenCalledWith(
        `${REPO_PATH}/contents/content/posts/hello.md?ref=main`,
      );

      expect(commitChanges).toHaveBeenCalledWith(
        [{ action: 'delete', path: 'content/posts/hello.md', previousSha: 'main-sha' }],
        expect.anything(),
      );
    });

    describe('onto an existing pull request', () => {
      const pullRequest = /** @type {any} */ ({
        number: 5,
        branch: 'cms/posts/hello',
        headSHA: 'head1',
      });

      /**
       * Mock the REST API, reporting the given branch head and blob SHA.
       * @param {string | undefined} head Commit the branch points at, `undefined` if it’s gone.
       */
      const mockBranch = (head) => {
        vi.mocked(fetchAPI).mockImplementation(async (path) => {
          if (path.includes('/branches/')) {
            if (!head) {
              throw new Error('Not Found', { cause: { status: 404 } });
            }

            return { commit: { id: head } };
          }

          return { sha: 'head-sha' };
        });
      };

      test('commits with the SHAs at the head commit on record', async () => {
        mockBranch('head1');
        vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });

        const result = await savePullRequest({
          ...args,
          pullRequest,
          changes: [{ action: 'update', path: 'content/posts/hello.md', previousSha: 'stale' }],
        });

        expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/branches/cms/posts/hello`);
        // A push that lands in the last moment and touches the file makes the instance refuse the
        // save, rather than having it go on top unseen
        expect(fetchAPI).toHaveBeenCalledWith(
          `${REPO_PATH}/contents/content/posts/hello.md?ref=head1`,
        );
        expect(commitChanges).toHaveBeenCalledWith(
          [{ action: 'update', path: 'content/posts/hello.md', previousSha: 'head-sha' }],
          { commitType: 'create', branch: 'cms/posts/hello' },
        );
        expect(result.pullRequest).toBe(pullRequest);
      });

      test('refuses to save onto a branch that has moved on from the commit on record', async () => {
        // The instance can’t be told which commit to go on top of, so whatever was pushed since —
        // which the board may not have shown — would go out with the save
        mockBranch('head2');

        const error = await savePullRequest({ ...args, pullRequest }).catch((ex) => ex);

        expect(error.message).toBe('The workflow branch has moved since the entry was loaded.');
        expect(error.cause.message).toBe('save_conflict.branch_moved');
        expect(commitChanges).not.toHaveBeenCalled();
      });

      test('refuses to save without a head commit on record', async () => {
        mockBranch('head1');

        const error = await savePullRequest({
          ...args,
          pullRequest: { ...pullRequest, headSHA: undefined },
        }).catch((ex) => ex);

        expect(error.cause.message).toBe('save_conflict.branch_moved');
        expect(commitChanges).not.toHaveBeenCalled();
      });

      test('says so in words when the branch is gone', async () => {
        mockBranch(undefined);

        const error = await savePullRequest({ ...args, pullRequest }).catch((ex) => ex);

        expect(error.message).toBe('Failed to save the changes.');
        expect(error.cause.message).toBe(
          'branch_not_found {"repo":"repo","branch":"cms/posts/hello"}',
        );
        expect(commitChanges).not.toHaveBeenCalled();
      });

      test('passes on a failure to look the branch up', async () => {
        const failure = new Error('Server', { cause: { status: 500 } });

        vi.mocked(fetchAPI).mockRejectedValue(failure);

        await expect(savePullRequest({ ...args, pullRequest })).rejects.toBe(failure);
        expect(commitChanges).not.toHaveBeenCalled();
      });
    });

    /** Gitea/Forgejo’s response to `new_branch` when the branch already exists. */
    const branchExists = new Error('branch already exists [name: cms/posts/hello]', {
      cause: { status: 422 },
    });

    /**
     * Mock the REST API for a save that has to sort out a leftover branch.
     * @param {any[]} openPullRequests Open pull requests the instance lists.
     */
    const mockLeftoverBranch = (openPullRequests) => {
      vi.mocked(fetchAPI).mockImplementation(async (path, options) => {
        if (path === '/settings/api') {
          return { max_response_items: 50 };
        }

        if (path.includes('/pulls?')) {
          return openPullRequests;
        }

        if (options?.method === 'DELETE') {
          return new Response();
        }

        if (path.endsWith('/labels')) {
          return [{ name: 'sveltia-cms/draft' }];
        }

        return {
          id: 900,
          number: 5,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        };
      });
    };

    test('starts over from the configured branch when the branch was left over', async () => {
      vi.mocked(commitChanges)
        .mockRejectedValueOnce(branchExists)
        .mockResolvedValueOnce({ sha: 'def', files: {} });
      mockLeftoverBranch([
        { number: 3, head: { ref: 'cms/posts/other', repo_id: 1 }, base: { repo_id: 1 } },
      ]);

      const result = await savePullRequest(args);

      // The branch is left over from a pull request closed on the instance rather than discarded
      // in the CMS. Starting from it as it stands would carry that work into the new pull request,
      // so it’s deleted and created afresh from the configured branch by the retried commit
      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        `${REPO_PATH}/pulls?state=open&sort=recentupdate&page=1&limit=50`,
      );
      expect(fetchAPI).toHaveBeenNthCalledWith(3, `${REPO_PATH}/branches/cms/posts/hello`, {
        method: 'DELETE',
        responseType: 'text',
      });
      expect(commitChanges).toHaveBeenCalledTimes(2);
      expect(commitChanges).toHaveBeenLastCalledWith([], {
        commitType: 'create',
        branch: 'cms/posts/hello',
        startBranch: 'main',
      });
      expect(result.pullRequest.number).toBe(5);
    });

    test('starts over when the only open pull request comes from a fork', async () => {
      vi.mocked(commitChanges)
        .mockRejectedValueOnce(branchExists)
        .mockResolvedValueOnce({ sha: 'def', files: {} });
      // A fork can have a branch of the same name, but its pull request isn’t this branch’s, so it
      // must not pass for work in progress and keep the leftover branch alive
      mockLeftoverBranch([
        { number: 3, head: { ref: 'cms/posts/hello', repo_id: 2 }, base: { repo_id: 1 } },
      ]);

      const result = await savePullRequest(args);

      expect(fetchAPI).toHaveBeenNthCalledWith(3, `${REPO_PATH}/branches/cms/posts/hello`, {
        method: 'DELETE',
        responseType: 'text',
      });
      expect(result.pullRequest.number).toBe(5);
    });

    test('starts over when the instance reports no head repository', async () => {
      vi.mocked(commitChanges)
        .mockRejectedValueOnce(branchExists)
        .mockResolvedValueOnce({ sha: 'def', files: {} });
      // The head repository has been deleted, so there’s nothing to trust the branch name against
      mockLeftoverBranch([
        { number: 3, head: { ref: 'cms/posts/hello', repo_id: -1 }, base: { repo_id: 1 } },
      ]);

      await savePullRequest(args);

      expect(fetchAPI).toHaveBeenNthCalledWith(
        3,
        `${REPO_PATH}/branches/cms/posts/hello`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    test('refuses to save onto a branch that has an open pull request the load missed', async () => {
      vi.mocked(commitChanges).mockRejectedValueOnce(branchExists);
      mockLeftoverBranch([
        { number: 7, head: { ref: 'cms/posts/hello', repo_id: 1 }, base: { repo_id: 1 } },
      ]);

      // The pull request has lost its label, sits beyond the number fetched, goes to another
      // branch, or was never the CMS’s. Committing onto it would take whatever else it holds along
      // with the entry, unseen, and deleting the branch would close it
      const error = await savePullRequest(args).catch((ex) => ex);

      expect(error.message).toBe('The workflow branch is in use by another pull request.');
      expect(error.cause.message).toBe('workflow.branch_in_use {"number":"#7"}');

      expect(fetchAPI).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(commitChanges).toHaveBeenCalledTimes(1);
    });

    test('rethrows a commit failure that isn’t about the branch existing', async () => {
      vi.mocked(commitChanges).mockRejectedValue(
        new Error('Forbidden', { cause: { status: 403 } }),
      );

      await expect(savePullRequest(args)).rejects.toThrow('Forbidden');
      expect(fetchAPI).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    const pullRequest = /** @type {any} */ ({
      number: 1,
      title: 'Create Post “hello”',
      status: 'draft',
    });

    beforeEach(() => {
      vi.mocked(fetchAPI).mockImplementation(async (path, options) =>
        path.endsWith('/labels') && options?.method === undefined
          ? [{ name: 'sveltia-cms/draft' }]
          : [{ name: 'sveltia-cms/pending_publish' }],
      );
    });

    test('swaps the label and drops the WIP prefix', async () => {
      const result = await updateStatus(pullRequest, 'pending_publish');

      expect(fetchAPI).toHaveBeenNthCalledWith(2, `${REPO_PATH}/issues/1/labels`, {
        method: 'PUT',
        body: { labels: ['sveltia-cms/pending_publish'] },
      });

      expect(fetchAPI).toHaveBeenNthCalledWith(3, `${REPO_PATH}/pulls/1`, {
        method: 'PATCH',
        body: { title: 'Create Post “hello”' },
      });

      expect(result.status).toBe('pending_publish');
    });

    test('leaves the title alone between the review stages', async () => {
      await updateStatus({ ...pullRequest, status: 'pending_review' }, 'pending_publish');

      expect(fetchAPI).toHaveBeenCalledTimes(2);
    });

    test('adds the WIP prefix when going back to the draft status', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path, options) =>
        path.endsWith('/labels') && options?.method === undefined
          ? [{ name: 'sveltia-cms/pending_review' }]
          : [{ name: 'sveltia-cms/draft' }],
      );

      await updateStatus({ ...pullRequest, status: 'pending_review' }, 'draft');

      expect(getRequestBody(2)).toEqual({ title: 'WIP: Create Post “hello”' });
    });
  });

  describe('fetchMergeState', () => {
    const pullRequest = /** @type {any} */ ({
      number: 1,
      branch: 'cms/posts/hello',
      headSHA: 'abc123',
    });

    /**
     * Create a changed file as returned by the REST API, listed at the given commit.
     * @param {string} filename File path.
     * @param {string} status File status.
     * @param {object} [options] Options.
     * @param {string} [options.ref] Commit the file was listed at.
     * @param {string} [options.previous] Path a renamed file had before.
     * @returns {any} Changed file.
     */
    const createFile = (filename, status, { ref = 'abc123', previous } = {}) => ({
      filename,
      status,
      previous_filename: previous,
      contents_url: `https://gitea.com/api/v1/repos/owner/repo/contents/${filename}?ref=${ref}`,
    });

    /**
     * Mock the REST API for a merge state read.
     * @param {object} args Arguments.
     * @param {any} [args.item] Pull request.
     * @param {any[][]} [args.lists] Changed file lists returned one read after another, the last
     * one repeated.
     * @param {Record<string, any[]>} [args.dirs] Folder listings keyed by folder path.
     */
    const mockMergeState = ({ item = createItem(), lists = [], dirs = {} }) => {
      let read = 0;

      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path === '/settings/api') {
          return { max_response_items: 50 };
        }

        if (path.includes('/files?')) {
          const list = lists[Math.min(read, lists.length - 1)];

          read += 1;

          return list;
        }

        const [, dir = ''] = path.match(/\/contents(?:\/([^?]*))?\?ref=abc123$/) ?? [];

        if (path.includes('/contents')) {
          return dirs[dir] ?? [];
        }

        return item;
      });
    };

    test('lists the files changed as of the head commit, with their modes', async () => {
      mockMergeState({
        lists: [
          [
            createFile('content/posts/hello.md', 'changed'),
            createFile('content/posts/new.md', 'added'),
            createFile('content/posts/gone.md', 'deleted'),
            createFile('content/posts/moved.md', 'renamed', { previous: 'content/posts/old.md' }),
            createFile('content/posts/copy.md', 'copied'),
            createFile('static/image.png', 'unchanged'),
            createFile('link', 'changed'),
          ],
        ],
        dirs: {
          'content/posts': [
            { path: 'content/posts/hello.md', type: 'file' },
            { path: 'content/posts/new.md', type: 'file' },
            { path: 'content/posts/moved.md', type: 'file' },
            { path: 'content/posts/copy.md', type: 'file' },
            { path: 'content/posts/sub', type: 'dir' },
          ],
          static: [{ path: 'static/image.png', type: 'submodule' }],
          '': [
            { path: 'link', type: 'symlink' },
            { path: 'other', type: 'unknown' },
          ],
        },
      });

      await expect(fetchMergeState(pullRequest)).resolves.toEqual({
        headSHA: 'abc123',
        onConfiguredBranches: true,
        files: [
          { path: 'content/posts/hello.md', status: 'modified', mode: '100644' },
          { path: 'content/posts/new.md', status: 'added', mode: '100644' },
          { path: 'content/posts/gone.md', status: 'removed', mode: undefined },
          {
            path: 'content/posts/moved.md',
            status: 'renamed',
            previousPath: 'content/posts/old.md',
            mode: '100644',
          },
          { path: 'content/posts/copy.md', status: 'added', mode: '100644' },
          { path: 'static/image.png', status: 'modified', mode: '160000' },
          { path: 'link', status: 'modified', mode: '120000' },
        ],
        complete: true,
      });

      // The folders are listed at the head commit, the root folder included
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/contents/content/posts?ref=abc123`);
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/contents?ref=abc123`);
    });

    test('waits for the list to catch up with the head commit', async () => {
      vi.useFakeTimers();

      try {
        mockMergeState({
          lists: [
            // The instance hasn’t moved its reference to the latest commit yet
            [createFile('content/posts/hello.md', 'changed', { ref: 'old456' })],
            [],
            [
              createFile('content/posts/hello.md', 'changed'),
              createFile('.github/workflows/x.yml', 'added'),
            ],
          ],
        });

        const promise = fetchMergeState(pullRequest);

        await vi.runAllTimersAsync();

        const state = await promise;

        expect(state.complete).toBe(true);
        expect(state.files.map(({ path }) => path)).toEqual([
          'content/posts/hello.md',
          '.github/workflows/x.yml',
        ]);
      } finally {
        vi.useRealTimers();
      }
    });

    test('can’t vouch for a list that never catches up', async () => {
      vi.useFakeTimers();

      try {
        mockMergeState({
          lists: [[createFile('content/posts/hello.md', 'changed', { ref: 'old456' })]],
        });

        const promise = fetchMergeState(pullRequest);

        await vi.runAllTimersAsync();

        await expect(promise).resolves.toMatchObject({ complete: false });

        expect(
          vi.mocked(fetchAPI).mock.calls.filter(([path]) => path.includes('/files?')),
        ).toHaveLength(10);
      } finally {
        vi.useRealTimers();
      }
    });

    test('can’t vouch for a list with a link it can’t read', async () => {
      vi.useFakeTimers();

      try {
        mockMergeState({
          lists: [[{ filename: 'content/posts/hello.md', status: 'changed', contents_url: '/' }]],
        });

        const promise = fetchMergeState(pullRequest);

        await vi.runAllTimersAsync();

        await expect(promise).resolves.toMatchObject({ complete: false });
      } finally {
        vi.useRealTimers();
      }
    });

    test('takes an empty list once the reference confirms the head commit', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path === '/settings/api') {
          return { max_response_items: 50 };
        }

        if (path.includes('/files?')) {
          return [];
        }

        if (path.endsWith('/git/refs/pull/1/head')) {
          return [{ ref: 'refs/pull/1/head', object: { sha: 'abc123' } }];
        }

        return createItem();
      });

      await expect(fetchMergeState(pullRequest)).resolves.toEqual({
        headSHA: 'abc123',
        onConfiguredBranches: true,
        files: [],
        complete: true,
      });
    });

    test('can’t vouch for a list cut short by the page cap', async () => {
      const page = Array.from({ length: 50 }, (_, index) =>
        createFile(`content/posts/${index}.md`, 'changed'),
      );

      mockMergeState({ lists: [page] });

      await expect(fetchMergeState(pullRequest)).resolves.toMatchObject({ complete: false });
    });

    test.each([
      [
        'goes to another branch',
        { base: { ref: 'develop', repo_id: 1, repo: { full_name: 'owner/repo' } } },
      ],
      ['comes from a fork', { head: { ref: 'cms/posts/hello', sha: 'abc123', repo_id: 2 } }],
    ])(
      'reports a pull request that %s as off the configured branches',
      async (_label, overrides) => {
        mockMergeState({ item: createItem(overrides) });

        await expect(fetchMergeState(pullRequest)).resolves.toEqual({
          headSHA: 'abc123',
          onConfiguredBranches: false,
          files: [],
          complete: false,
        });

        expect(fetchAPI).toHaveBeenCalledTimes(1);
      },
    );

    test('lists nothing when the branch has moved on from the commit on record', async () => {
      // The check refuses a moved branch outright, so there’s no waiting for a list of a commit
      // that won’t be merged
      mockMergeState({ lists: [[createFile('content/posts/hello.md', 'changed')]] });

      await expect(fetchMergeState({ ...pullRequest, headSHA: 'old456' })).resolves.toEqual({
        headSHA: 'abc123',
        onConfiguredBranches: true,
        files: [],
        complete: true,
      });

      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });

    test('takes a renamed repository’s pull request as on the configured branches', async () => {
      // The instance redirects the configured name to the new one, which the pull request carries
      mockMergeState({
        item: createItem({ base: { ref: 'main', repo_id: 1, repo: { full_name: 'owner/new' } } }),
        lists: [[createFile('content/posts/hello.md', 'changed')]],
      });

      await expect(fetchMergeState(pullRequest)).resolves.toMatchObject({
        onConfiguredBranches: true,
        complete: true,
      });
    });

    test('reports a pull request without a head commit as off the configured branches', async () => {
      mockMergeState({ item: createItem({ head: { ref: 'cms/posts/hello', repo_id: 1 } }) });

      await expect(fetchMergeState(pullRequest)).resolves.toMatchObject({
        headSHA: undefined,
        onConfiguredBranches: false,
      });
    });
  });

  describe('fetchUnchangedPaths', () => {
    test('compares the blobs on the configured branch and at the head commit', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        const [, file, ref] = path.match(/\/contents\/(.+)\?ref=(.+)$/) ?? [];

        const shas = /** @type {Record<string, string>} */ ({
          'same.md@main': 'a',
          'same.md@abc123': 'a',
          'changed.md@main': 'b',
          'changed.md@abc123': 'c',
          'added.md@abc123': 'd',
        });

        const sha = shas[`${file}@${ref}`];

        if (!sha) {
          throw new Error('Not Found', { cause: { status: 404 } });
        }

        return { sha };
      });

      await expect(
        fetchUnchangedPaths({
          headSHA: 'abc123',
          paths: ['same.md', 'changed.md', 'added.md', 'missing.md'],
        }),
      ).resolves.toEqual(['same.md', 'missing.md']);
    });

    test('reads the configured repository even with a fork on record', async () => {
      forkedRepository.current = { owner: 'me', repo: 'fork' };
      vi.mocked(fetchAPI).mockResolvedValue({ sha: 'a' });

      await fetchUnchangedPaths({ headSHA: 'abc123', paths: ['same.md'] });

      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/contents/same.md?ref=main`);
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/contents/same.md?ref=abc123`);
    });
  });

  describe('publish', () => {
    const pullRequest = /** @type {any} */ ({
      number: 1,
      branch: 'cms/posts/hello',
      title: 'Create Post',
      headSHA: 'abc123',
    });

    test('merges the pull request and deletes the branch', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(new Response(null, { status: 200 }));

      await publish(pullRequest);

      expect(fetchAPI).toHaveBeenNthCalledWith(1, `${REPO_PATH}/pulls/1/merge`, {
        method: 'POST',
        responseType: 'raw',
        body: {
          Do: 'merge',
          MergeTitleField: 'Create Post',
          MergeMessageField: '',
          // The merge is pinned to the commit the entry was loaded or saved at
          head_commit_id: 'abc123',
        },
      });

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        `${REPO_PATH}/branches/cms/posts/hello`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    test('uses a squash merge when configured', async () => {
      cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitea', squash_merges: true } });
      vi.mocked(fetchAPI).mockResolvedValue(new Response(null, { status: 200 }));

      await publish(pullRequest);

      expect(getRequestBody().Do).toBe('squash');
    });

    test('falls back to a regular merge without the config', async () => {
      cmsConfig.current = undefined;
      vi.mocked(fetchAPI).mockResolvedValue(new Response(null, { status: 200 }));

      await publish(pullRequest);

      expect(getRequestBody().Do).toBe('merge');
    });

    test('takes a pull request merged since the board was loaded as done', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path, options) => {
        if (options?.method === 'POST') {
          // Everything that stops a merge, this one included, comes back as a 405
          return new Response(JSON.stringify({ message: 'PR already merged' }), { status: 405 });
        }

        // The merge check answers 204 once the pull request has been merged
        return new Response(null, { status: path.endsWith('/merge') ? 204 : 200 });
      });

      await expect(publish(pullRequest)).resolves.toBeUndefined();

      expect(fetchAPI).toHaveBeenNthCalledWith(2, `${REPO_PATH}/pulls/1/merge`, {
        responseType: 'raw',
      });

      // The branch is still worth tidying up
      expect(fetchAPI).toHaveBeenNthCalledWith(
        3,
        `${REPO_PATH}/branches/cms/posts/hello`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    test('reports a 405 that isn’t about the pull request being merged', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path, options) =>
        options?.method === 'POST'
          ? new Response(JSON.stringify({ message: 'PR is not ready to be merged' }), {
              status: 405,
            })
          : // The merge check answers 404 while the pull request is still open
            new Response(null, { status: 404 }),
      );

      await expect(publish(pullRequest)).rejects.toThrow('Failed to merge the pull request');
      expect(fetchAPI).toHaveBeenCalledTimes(2);
    });

    test('throws when the merge is refused, keeping the branch', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        new Response(JSON.stringify({ message: 'Please try again later' }), { status: 409 }),
      );

      await expect(publish(pullRequest)).rejects.toThrow('Failed to merge the pull request');
      // A refusal that isn’t a 405 needs no merge check, and the branch is left alone
      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });

    test('throws even when the error body cannot be parsed', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(new Response('<html>', { status: 500 }));

      await expect(publish(pullRequest)).rejects.toThrow('Failed to merge the pull request');
    });
  });

  describe('discard', () => {
    test('carries on when the pull request was merged since the board was loaded', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path, options) => {
        if (options?.method === 'PATCH') {
          // The instance refuses any state change on a merged pull request
          throw new Error('Server responded with an error', { cause: { status: 412 } });
        }

        return new Response(null, { status: 204 });
      });

      await expect(
        discard(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello' })),
      ).resolves.toBeUndefined();

      // There’s nothing left to close, but the branch is still worth tidying up
      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        `${REPO_PATH}/branches/cms/posts/hello`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    test('reports any other refusal, leaving the branch alone', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', { cause: { status: 403 } }),
      );

      await expect(
        discard(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello' })),
      ).rejects.toThrow('Server responded with an error');

      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });

    test('closes the pull request and deletes the branch', async () => {
      await discard(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello' }));

      expect(fetchAPI).toHaveBeenNthCalledWith(1, `${REPO_PATH}/pulls/1`, {
        method: 'PATCH',
        body: { state: 'closed' },
      });

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        `${REPO_PATH}/branches/cms/posts/hello`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('fetchPullRequests', () => {
    test('lists the labelled pull requests in the regular flow', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([]);

      await expect(fetchPullRequests()).resolves.toEqual([]);
      expect(fetchAPI).toHaveBeenCalledWith(expect.stringContaining('/labels?'));
      expect(fetchForkPullRequests).not.toHaveBeenCalled();
    });

    test('lists the fork branches for an Open Authoring contributor', async () => {
      forkedRepository.current = { owner: 'me', repo: 'repo' };
      vi.mocked(fetchForkPullRequests).mockResolvedValue([]);

      await expect(fetchPullRequests()).resolves.toEqual([]);
      expect(fetchForkPullRequests).toHaveBeenCalled();
      expect(fetchAPI).not.toHaveBeenCalled();
    });
  });

  describe('Open Authoring', () => {
    const args = /** @type {any} */ ({
      changes: [],
      options: { commitType: 'create' },
      branch: 'cms/me/repo/posts/hello',
      title: 'Create Post “hello”',
      status: 'draft',
    });

    beforeEach(() => {
      forkedRepository.current = { owner: 'me', repo: 'repo' };
    });

    test('saves a draft as a branch without a pull request', async () => {
      vi.mocked(commitChanges).mockResolvedValue({
        sha: 'def',
        date: new Date('2026-01-01T00:00:00Z'),
        files: {},
      });

      const result = await savePullRequest(args);

      // The branch is created in the fork by the commit; nothing else is requested
      expect(commitChanges).toHaveBeenCalledWith([], {
        commitType: 'create',
        branch: 'cms/me/repo/posts/hello',
        startBranch: 'main',
      });
      expect(fetchAPI).not.toHaveBeenCalled();

      expect(result.pullRequest).toEqual({
        title: 'Create Post “hello”',
        branch: 'cms/me/repo/posts/hello',
        status: 'draft',
        createdDate: new Date('2026-01-01T00:00:00Z'),
        updatedDate: new Date('2026-01-01T00:00:00Z'),
        files: [],
        canMerge: false,
      });
    });

    test('commits onto a leftover branch rather than wiping it', async () => {
      vi.mocked(commitChanges)
        .mockRejectedValueOnce(
          new Error('branch already exists [name: cms/me/repo/posts/hello]', {
            cause: { status: 422 },
          }),
        )
        .mockResolvedValueOnce({ sha: 'def', date: new Date(), files: {} });

      await savePullRequest(args);

      // A draft is a branch without a pull request, so there’s no telling a leftover from a live
      // one: the branch is kept, and nothing is looked up or deleted on the way
      expect(fetchAPI).not.toHaveBeenCalled();
      expect(commitChanges).toHaveBeenLastCalledWith([], {
        commitType: 'create',
        branch: 'cms/me/repo/posts/hello',
      });
    });

    test('opens the pull request when the status is not a draft', async () => {
      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', date: new Date(), files: {} });
      vi.mocked(fetchAPI).mockResolvedValue({
        id: 900,
        number: 5,
        html_url: 'u',
        head: { sha: 'def' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      const result = await savePullRequest({ ...args, status: 'pending_review' });

      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/pulls`, {
        method: 'POST',
        body: expect.objectContaining({ head: 'me:cms/me/repo/posts/hello' }),
      });
      expect(result.pullRequest.number).toBe(5);
    });

    test('moves an entry between stages through the fork flow', async () => {
      const pullRequest = /** @type {any} */ ({ branch: 'cms/me/repo/posts/hello' });
      const updated = /** @type {any} */ ({ ...pullRequest, status: 'pending_review' });

      vi.mocked(updateForkStatus).mockResolvedValue(updated);

      await expect(updateStatus(pullRequest, 'pending_review')).resolves.toBe(updated);
      expect(updateForkStatus).toHaveBeenCalledWith(pullRequest, 'pending_review');
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    test('refuses to publish', async () => {
      await expect(
        publish(/** @type {any} */ ({ number: 1, branch: 'cms/me/repo/posts/hello' })),
      ).rejects.toThrow('Cannot publish as an Open Authoring contributor');
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    test('discards a draft that has no pull request by deleting the branch alone', async () => {
      await discard(/** @type {any} */ ({ branch: 'cms/me/repo/posts/hello' }));

      expect(fetchAPI).toHaveBeenCalledTimes(1);
      expect(fetchAPI).toHaveBeenCalledWith('/repos/me/repo/branches/cms/me/repo/posts/hello', {
        method: 'DELETE',
        responseType: 'text',
      });
    });
  });
});
