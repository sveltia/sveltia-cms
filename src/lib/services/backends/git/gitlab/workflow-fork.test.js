import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getWorkflowRepository } from '$lib/services/backends/git/gitlab/fork';
import {
  createForkMergeRequest,
  fetchForkBranchFileList,
  fetchForkBranchList,
  fetchForkBranchMergeRequests,
  fetchForkPullRequests,
  parseForkBranch,
  updateForkStatus,
} from '$lib/services/backends/git/gitlab/workflow-fork';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { user } from '$lib/services/user/account.svelte';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

vi.mock('$lib/services/backends/git/gitlab/fork', () => ({
  getWorkflowRepository: vi.fn(),
  projectIds: { base: 42, fork: 77 },
}));
vi.mock('$lib/services/backends/git/gitlab/repository', () => {
  const mockRepository = { owner: 'group/sub', repo: 'project', branch: 'main' };
  /**
   * Get the project ID the same way the real module does.
   * @param {any} [repoPath] Project to address. Default: the configured project.
   * @returns {string} URL-encoded project path.
   */
  const getProjectId = ({ owner, repo } = mockRepository) => encodeURIComponent(`${owner}/${repo}`);

  return {
    repository: mockRepository,
    getProjectId,
    /**
     * Get the branch path the same way the real module does.
     * @param {string} branch Branch name.
     * @param {any} [repoPath] Project holding the branch.
     * @returns {string} REST API path.
     */
    getBranchPath: (branch, repoPath) =>
      `/projects/${getProjectId(repoPath)}/repository/branches/${encodeURIComponent(branch)}`,
  };
});
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));
vi.mock('$lib/services/user/account.svelte', () => ({ user: { account: { id: 7 } } }));
vi.mock('$lib/services/workflow/open-authoring', () => ({
  ENTRY_ALREADY_PUBLISHED: 'entry_already_published',
  forkedRepository: { current: undefined },
}));

const PROJECT_ID = encodeURIComponent('group/sub/project');
const FORK = { owner: 'contributor', repo: 'project' };
const FORK_ID = encodeURIComponent('contributor/project');
/** Branch prefix an Open Authoring contributor’s branches carry. */
const FORK_PREFIX = 'cms/contributor/project/';
/** Path of the branch an Open Authoring contributor is working on, ready to go in a URL. */
const FORK_BRANCH_ID = encodeURIComponent(`${FORK_PREFIX}posts/hello`);
/**
 * Get the request body passed to the given `fetchAPI` call.
 * @param {number} [index] Call index.
 * @returns {any} Request body.
 */
const getRequestBody = (index = 0) => vi.mocked(fetchAPI).mock.calls[index][1]?.body;

/**
 * Create a raw branch as returned by the REST API.
 * @param {object} [overrides] Properties to override.
 * @returns {any} Branch.
 */
const createBranch = (overrides = {}) => ({
  name: `${FORK_PREFIX}posts/hello`,
  commit: {
    id: 'head1',
    message: 'Create Post “hello”',
    author_name: 'Contributor',
    author_email: 'me@example.com',
    committed_date: '2026-01-01T00:00:00Z',
  },
  ...overrides,
});

/**
 * Create a raw merge request opened from the contributor’s fork, as returned by the REST API.
 * @param {object} [overrides] Properties to override.
 * @returns {any} Merge request.
 */
const createForkItem = (overrides = {}) => ({
  id: 900,
  iid: 1,
  title: 'Draft: Create Post “hello”',
  web_url: 'https://gitlab.com/group/sub/project/-/merge_requests/1',
  source_branch: `${FORK_PREFIX}posts/hello`,
  source_project_id: 77,
  target_project_id: 42,
  target_branch: 'main',
  state: 'opened',
  draft: true,
  sha: 'head1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  author: { id: 7, name: 'Me', username: 'me' },
  ...overrides,
});

/** Merge request as returned by the REST API on creation. */
const createdMergeRequest = {
  id: 900,
  iid: 5,
  web_url: 'u',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

/**
 * Create the error `fetchAPI` throws when GitLab refuses a request.
 * @param {number} status HTTP status.
 * @returns {Error} Error with the status in its cause, like the real one.
 */
const createAPIError = (status) =>
  new Error('Server responded with an error', { cause: { status } });

describe('GitLab Open Authoring workflow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    forkedRepository.current = FORK;
    vi.mocked(getWorkflowRepository).mockReturnValue(FORK);
    vi.mocked(fetchAPI).mockResolvedValue({});
    vi.mocked(fetchGraphQL).mockResolvedValue({});
  });

  describe('fetchForkBranchList', () => {
    test('lists the workflow branches in the fork', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([createBranch()]);

      const branches = await fetchForkBranchList();

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${FORK_ID}/repository/branches` +
          `?search=${encodeURIComponent(`^${FORK_PREFIX}`)}&per_page=100`,
      );

      expect(branches).toHaveLength(1);
    });

    test('warns when the branch list is capped', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      vi.mocked(fetchAPI).mockResolvedValue(
        Array.from({ length: 100 }, (_item, index) =>
          createBranch({ name: `${FORK_PREFIX}posts/post-${index}` }),
        ),
      );

      await fetchForkBranchList();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Only the first 100'));
      warn.mockRestore();
    });
  });

  describe('fetchForkBranchMergeRequests', () => {
    test('asks for nothing when there are no branches', async () => {
      await expect(fetchForkBranchMergeRequests([])).resolves.toEqual(new Map());
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    test('matches the contributor’s own merge requests to their branches', async () => {
      const branch = `${FORK_PREFIX}posts/hello`;

      vi.mocked(fetchAPI).mockResolvedValue([
        // Opened on the configured project itself, so not from the fork
        createForkItem({ iid: 8, source_project_id: 42 }),
        // From another project of the contributor’s that happens to have a branch of the same name
        // @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-p8qh-54q9-2qjx
        createForkItem({ iid: 7, source_project_id: 99 }),
        createForkItem({ iid: 9 }),
        // The list is newest first, so this older one is ignored
        createForkItem({ iid: 3 }),
        // Aimed at another branch of the project, so it isn’t the review of this entry
        createForkItem({ iid: 6, target_branch: 'develop' }),
        // Opened by someone else from the contributor’s branch, which the author filter should have
        // left out already
        createForkItem({ iid: 10, author: { id: 8, name: 'Them', username: 'them' } }),
        // A branch that isn’t on the board
        createForkItem({ iid: 4, source_branch: `${FORK_PREFIX}posts/other` }),
      ]);

      const map = await fetchForkBranchMergeRequests([branch]);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/merge_requests?state=all&order_by=created_at&sort=desc` +
          '&author_id=7&per_page=100',
      );

      expect(map.get(branch)?.iid).toBe(9);
      expect(map.size).toBe(1);
    });

    test('matches nothing while the user is unknown', async () => {
      const { account } = user;

      vi.mocked(fetchAPI).mockResolvedValue([createForkItem({ author: undefined })]);
      user.account = undefined;

      try {
        const map = await fetchForkBranchMergeRequests([`${FORK_PREFIX}posts/hello`]);

        expect(map.size).toBe(0);
      } finally {
        user.account = account;
      }
    });
  });

  describe('parseForkBranch', () => {
    test('reads a draft off the branch alone', () => {
      expect(parseForkBranch(createBranch())).toEqual({
        number: undefined,
        nodeId: undefined,
        title: 'Create Post “hello”',
        url: undefined,
        branch: `${FORK_PREFIX}posts/hello`,
        headSHA: 'head1',
        status: 'draft',
        createdDate: new Date('2026-01-01T00:00:00Z'),
        updatedDate: new Date('2026-01-01T00:00:00Z'),
        author: { name: 'Contributor', email: 'me@example.com' },
        files: [],
        // Only a maintainer merges
        canMerge: false,
      });
    });

    test('handles a branch without commit details', () => {
      const result = parseForkBranch(createBranch({ commit: undefined }));

      expect(result.title).toBe('');
      expect(result.author).toBeUndefined();
    });

    test('handles a commit and a merge request author without a display name', () => {
      expect(
        parseForkBranch(
          createBranch({ commit: { message: 'Create Post', author_name: 'Contributor' } }),
        ).author,
      ).toEqual({ name: 'Contributor', email: '' });

      expect(
        parseForkBranch(createBranch(), createForkItem({ author: { username: 'bot' } })).author,
      ).toEqual({ name: 'bot', email: '', id: undefined, login: 'bot' });
    });

    test('treats an open merge request that isn’t a draft as in review', () => {
      const result = parseForkBranch(createBranch(), createForkItem({ draft: false }));

      expect(result).toEqual(
        expect.objectContaining({
          number: 1,
          nodeId: '900',
          title: 'Create Post “hello”',
          status: 'pending_review',
          author: { name: 'Me', email: '', id: 7, login: 'me' },
        }),
      );
    });

    test('keeps an open draft merge request in the drafting stage', () => {
      expect(parseForkBranch(createBranch(), createForkItem()).status).toBe('draft');
    });

    test('treats a closed merge request as a draft, keeping it for a reopen', () => {
      const result = parseForkBranch(createBranch(), createForkItem({ state: 'closed' }));

      expect(result.status).toBe('draft');
      expect(result.number).toBe(1);
    });

    test('drops a merged merge request, leaving a fresh draft', () => {
      const result = parseForkBranch(createBranch(), createForkItem({ state: 'merged' }));

      expect(result.status).toBe('draft');
      expect(result.number).toBeUndefined();
      expect(result.title).toBe('Create Post “hello”');
    });
  });

  describe('fetchForkBranchFileList', () => {
    test('compares the fork’s branch with the configured branch', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        diffs: [
          { new_path: 'content/posts/hello.md', old_path: 'content/posts/hello.md' },
          { new_path: 'x', old_path: 'content/posts/gone.md', deleted_file: true },
        ],
      });

      const pullRequest = /** @type {any} */ ({ branch: `${FORK_PREFIX}posts/hello`, files: [] });

      await fetchForkBranchFileList(pullRequest);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${FORK_ID}/repository/compare?from=main&to=${FORK_BRANCH_ID}&from_project_id=42`,
      );

      expect(pullRequest.files).toEqual([
        {
          path: 'content/posts/hello.md',
          sha: '',
          size: 0,
          deleted: false,
          previousPath: undefined,
        },
        { path: 'content/posts/gone.md', sha: '', size: 0, deleted: true, previousPath: undefined },
      ]);
    });

    test('handles a comparison that reports nothing', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({});

      const pullRequest = /** @type {any} */ ({ branch: 'cms/x', files: [{}] });

      await fetchForkBranchFileList(pullRequest);
      expect(pullRequest.files).toEqual([]);
    });
  });

  describe('fetchForkPullRequests', () => {
    /**
     * Mock the API for the fork flow.
     * @param {object} args Arguments.
     * @param {any[]} args.branches Branches in the fork.
     * @param {any[]} [args.mergeRequests] The contributor’s merge requests.
     * @param {Record<string, any[]>} [args.diffs] Comparison diffs keyed by branch name.
     */
    const mockForkAPI = ({ branches, mergeRequests = [], diffs = {} }) => {
      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path.includes('/repository/branches?')) {
          return branches;
        }

        if (path.includes('/merge_requests?')) {
          return mergeRequests;
        }

        if (path.includes('/repository/compare')) {
          const [, branch] = path.match(/[?&]to=([^&]+)/) ?? [];

          return { diffs: diffs[decodeURIComponent(branch ?? '')] ?? [] };
        }

        return {};
      });

      vi.mocked(fetchGraphQL).mockResolvedValue({
        project: {
          repository: {
            blobs: {
              nodes: [
                { path: 'content/posts/hello.md', oid: 'sha1', size: '7', rawTextBlob: '# Hello' },
              ],
            },
          },
        },
      });
    };

    test('lists the branches with their files, read from the fork', async () => {
      mockForkAPI({
        branches: [createBranch()],
        diffs: { [`${FORK_PREFIX}posts/hello`]: [{ new_path: 'content/posts/hello.md' }] },
      });

      const result = await fetchForkPullRequests();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('draft');
      expect(result[0].files[0].text).toBe('# Hello');

      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('blobs'),
        expect.objectContaining({ fullPath: 'contributor/project' }),
      );
    });

    test('drops a branch that no longer differs from the configured branch', async () => {
      mockForkAPI({ branches: [createBranch()] });

      await expect(fetchForkPullRequests()).resolves.toEqual([]);
    });

    test('deletes a branch left behind by a merged merge request', async () => {
      mockForkAPI({
        branches: [createBranch()],
        mergeRequests: [createForkItem({ state: 'merged', sha: 'head1' })],
      });

      await expect(fetchForkPullRequests()).resolves.toEqual([]);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${FORK_ID}/repository/branches/${FORK_BRANCH_ID}`,
        { method: 'DELETE', responseType: 'text' },
      );
    });

    test('keeps a branch committed to since the merge', async () => {
      mockForkAPI({
        branches: [createBranch()],
        mergeRequests: [createForkItem({ state: 'merged', sha: 'old-head' })],
        diffs: { [`${FORK_PREFIX}posts/hello`]: [{ new_path: 'content/posts/hello.md' }] },
      });

      const result = await fetchForkPullRequests();

      expect(result).toHaveLength(1);
      // The merged merge request isn’t carried forward
      expect(result[0].number).toBeUndefined();
    });
  });

  describe('createForkMergeRequest', () => {
    const args = {
      branch: `${FORK_PREFIX}posts/hello`,
      title: 'Create Post “hello”',
      status: /** @type {any} */ ('pending_review'),
    };

    /**
     * Mock `fetchAPI` so that opening a merge request is refused as a duplicate, and the lookup
     * that follows returns the given merge requests.
     * @param {Record<string, any>[]} items Open merge requests from the branch.
     */
    const mockDuplicate = (items) => {
      vi.mocked(fetchAPI).mockImplementation(async (path, options) => {
        if (options?.method === 'POST') {
          throw createAPIError(409);
        }

        if (options?.method === 'PUT') {
          return {};
        }

        return /** @type {any} */ (
          /** @type {string} */ (path).includes('source_branch') ? items : {}
        );
      });
    };

    test('opens a merge request from the fork', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createdMergeRequest);

      const result = await createForkMergeRequest(args);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${FORK_ID}/merge_requests`,
        expect.objectContaining({ method: 'POST' }),
      );

      expect(result).toMatchObject({ number: 5, title: args.title, branch: args.branch });
    });

    test('takes over the merge request the load didn’t see', async () => {
      // The entry’s own merge request sits beyond the page the board was built from, so the entry
      // showed up as a draft and GitLab refuses a second merge request from the branch
      mockDuplicate([
        {
          ...createdMergeRequest,
          iid: 9,
          source_project_id: 77,
          target_branch: 'main',
          author: { id: 7 },
          state: 'opened',
          draft: true,
          title: 'Draft: Create Post “hello”',
        },
      ]);

      const result = await createForkMergeRequest(args);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/merge_requests` +
          `?state=opened&source_branch=${FORK_BRANCH_ID}&per_page=100`,
      );

      // Taking it out of draft is what hands it to the maintainers
      expect(fetchAPI).toHaveBeenLastCalledWith(`/projects/${PROJECT_ID}/merge_requests/9`, {
        method: 'PUT',
        body: { title: 'Create Post “hello”' },
      });

      expect(result).toMatchObject({
        number: 9,
        status: 'pending_review',
        title: args.title,
        branch: args.branch,
      });
    });

    test('leaves a merge request that is already in review alone', async () => {
      mockDuplicate([
        {
          ...createdMergeRequest,
          iid: 9,
          source_project_id: 77,
          target_branch: 'main',
          author: { id: 7 },
          state: 'opened',
          draft: false,
        },
      ]);

      const result = await createForkMergeRequest(args);

      expect(result.number).toBe(9);
      // The merge request already says what the entry does, so nothing was written
      expect(fetchAPI).not.toHaveBeenCalledWith(
        expect.stringContaining('/merge_requests/9'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    test('refuses a merge request from another project of the contributor’s', async () => {
      // A branch of the same name elsewhere says nothing about where the merge request came from
      // @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-p8qh-54q9-2qjx
      mockDuplicate([
        {
          ...createdMergeRequest,
          iid: 9,
          source_project_id: 99,
          target_branch: 'main',
          state: 'opened',
          draft: true,
        },
      ]);

      await expect(createForkMergeRequest(args)).rejects.toThrow('Server responded with an error');
    });

    test('refuses a merge request aimed at another branch', async () => {
      // The contributor opened it from the same branch to a branch the CMS doesn’t publish to, so
      // it isn’t this entry’s review to take over
      mockDuplicate([
        {
          ...createdMergeRequest,
          iid: 9,
          source_project_id: 77,
          target_branch: 'develop',
          state: 'opened',
          draft: true,
        },
      ]);

      await expect(createForkMergeRequest(args)).rejects.toThrow('Server responded with an error');
    });

    test('names a merge request someone else opened from the contributor’s branch', async () => {
      // Anyone the fork lets push can open one, and taking it over would hand their request to the
      // maintainers in the contributor’s name
      mockDuplicate([
        {
          ...createdMergeRequest,
          iid: 9,
          source_project_id: 77,
          target_branch: 'main',
          author: { id: 8 },
          state: 'opened',
          draft: true,
        },
      ]);

      await expect(createForkMergeRequest(args)).rejects.toThrow(
        'The workflow branch is in use by another merge request.',
      );
      expect(fetchAPI).not.toHaveBeenCalledWith(
        expect.stringContaining('/merge_requests/9'),
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    test('reports a refusal that isn’t a duplicate', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(createAPIError(403));

      await expect(createForkMergeRequest(args)).rejects.toThrow('Server responded with an error');

      // No lookup was made for a merge request that isn’t in the way
      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateForkStatus', () => {
    const pullRequest = /** @type {any} */ ({
      number: 1,
      branch: `${FORK_PREFIX}posts/hello`,
      title: 'Create Post “hello”',
      status: 'draft',
    });

    test('refuses to mark an entry ready to publish', async () => {
      await expect(updateForkStatus(pullRequest, 'pending_publish')).rejects.toThrow(
        'Cannot mark an entry ready to publish as an Open Authoring contributor',
      );

      expect(fetchAPI).not.toHaveBeenCalled();
    });

    test('leaves a branch without a merge request alone while it stays a draft', async () => {
      const result = await updateForkStatus({ ...pullRequest, number: undefined }, 'draft');

      expect(fetchAPI).not.toHaveBeenCalled();
      expect(result.status).toBe('draft');
    });

    test('opens the merge request when the entry is handed over for review', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createdMergeRequest);

      const result = await updateForkStatus(
        { ...pullRequest, number: undefined },
        'pending_review',
      );

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${FORK_ID}/merge_requests`,
        expect.objectContaining({ method: 'POST' }),
      );

      expect(result.number).toBe(5);
    });

    test('marks an open merge request as a draft when the entry goes back', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createForkItem({ state: 'opened', draft: false }));

      await updateForkStatus({ ...pullRequest, status: 'pending_review' }, 'draft');

      expect(fetchAPI).toHaveBeenLastCalledWith(`/projects/${PROJECT_ID}/merge_requests/1`, {
        method: 'PUT',
        body: { title: 'Draft: Create Post “hello”' },
      });
    });

    test('leaves a merge request that is already a draft alone', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createForkItem({ state: 'opened', draft: true }));

      await updateForkStatus(pullRequest, 'draft');

      // Only the state was read; nothing was written
      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });

    test('reopens a closed merge request and takes it out of draft', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createForkItem({ state: 'closed', draft: true }));

      await updateForkStatus(pullRequest, 'pending_review');

      expect(fetchAPI).toHaveBeenLastCalledWith(`/projects/${PROJECT_ID}/merge_requests/1`, {
        method: 'PUT',
        body: { state_event: 'reopen', title: 'Create Post “hello”' },
      });
      expect(getRequestBody(1)).not.toHaveProperty('labels');
    });

    test('opens a new merge request when the known one was aimed at another branch', async () => {
      // Retargeted on GitLab since the board was loaded, so it’s no longer the entry’s review, and
      // reopening it would hand a request for that other branch to the maintainers
      // @see https://github.com/sveltia/sveltia-cms/security/advisories/GHSA-8h97-74c4-g246
      vi.mocked(fetchAPI).mockImplementation(async (_path, options) =>
        options?.method === 'POST'
          ? createdMergeRequest
          : createForkItem({ state: 'closed', draft: true, target_branch: 'develop' }),
      );

      const result = await updateForkStatus(pullRequest, 'pending_review');

      expect(fetchAPI).not.toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/merge_requests/1`,
        expect.objectContaining({ method: 'PUT' }),
      );
      expect(fetchAPI).toHaveBeenLastCalledWith(
        `/projects/${FORK_ID}/merge_requests`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.number).toBe(5);
    });

    /** REST API path of the entry’s branch in the fork. */
    const FORK_BRANCH_PATH = `/projects/${FORK_ID}/repository/branches/${FORK_BRANCH_ID}`;

    /**
     * Answer the merge request lookup with one merged at `head1`, the branch lookup with the given
     * commit, and the creation of a merge request with a new one.
     * @param {string | undefined} head Commit the branch points at, `undefined` if it’s gone.
     * @param {object} [overrides] Properties to override on the merge request.
     */
    const mockMergedMergeRequest = (head, overrides = {}) => {
      vi.mocked(fetchAPI).mockImplementation(async (path, options) => {
        if (path === FORK_BRANCH_PATH) {
          if (options?.method === 'DELETE') {
            return '';
          }

          if (!head) {
            throw createAPIError(404);
          }

          return createBranch({ commit: { id: head } });
        }

        return options?.method === 'POST'
          ? createdMergeRequest
          : createForkItem({ state: 'merged', draft: false, sha: 'head1', ...overrides });
      });
    };

    test('opens a new merge request when the known one was merged and edited since', async () => {
      // The contributor committed to the branch after the merge, which makes the entry a fresh
      // draft
      mockMergedMergeRequest('head2');

      const result = await updateForkStatus(pullRequest, 'pending_review');

      expect(fetchAPI).toHaveBeenCalledWith(FORK_BRANCH_PATH);
      expect(fetchAPI).toHaveBeenLastCalledWith(
        `/projects/${FORK_ID}/merge_requests`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.number).toBe(5);
    });

    test('reports an entry merged since as published, rather than opening an empty request', async () => {
      // The branch still points at the commit the merge request was merged at, so it holds nothing
      // that isn’t on the configured branch already
      mockMergedMergeRequest('head1');

      await expect(updateForkStatus(pullRequest, 'pending_review')).rejects.toThrow(
        'entry_already_published',
      );

      // The leftover branch is deleted from the fork, the way the next load would
      expect(fetchAPI).toHaveBeenLastCalledWith(
        FORK_BRANCH_PATH,
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(fetchAPI).not.toHaveBeenCalledWith(
        `/projects/${FORK_ID}/merge_requests`,
        expect.objectContaining({ method: 'POST' }),
      );
    });

    test('reports an entry merged since as published when it goes back to draft', async () => {
      mockMergedMergeRequest('head1');

      await expect(
        updateForkStatus({ ...pullRequest, status: 'pending_review' }, 'draft'),
      ).rejects.toThrow('entry_already_published');
    });

    test('reports an entry as published when its branch went with the merge', async () => {
      mockMergedMergeRequest(undefined);

      await expect(updateForkStatus(pullRequest, 'pending_review')).rejects.toThrow(
        'entry_already_published',
      );

      // Nothing is left to delete, nor to open a merge request from
      expect(fetchAPI).toHaveBeenCalledTimes(2);
      expect(fetchAPI).not.toHaveBeenCalledWith(
        FORK_BRANCH_PATH,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    test('opens a new merge request when the known one was merged into another branch', async () => {
      // Retargeted and merged elsewhere: nothing of the entry reached the configured branch, so the
      // branch is kept, the way the load would keep it
      mockMergedMergeRequest('head1', { target_branch: 'develop' });

      const result = await updateForkStatus(pullRequest, 'pending_review');

      expect(fetchAPI).not.toHaveBeenCalledWith(FORK_BRANCH_PATH);
      expect(fetchAPI).toHaveBeenLastCalledWith(
        `/projects/${FORK_ID}/merge_requests`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(result.number).toBe(5);
    });

    test('lets go of a merged merge request when the entry goes back to draft', async () => {
      // Edited again since the merge, so the branch has moved on from it
      mockMergedMergeRequest('head2');

      const result = await updateForkStatus({ ...pullRequest, status: 'pending_review' }, 'draft');

      // A merged merge request can’t be marked a draft, nor does it say anything about the entry
      expect(fetchAPI).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({ number: undefined, nodeId: undefined, status: 'draft' });
    });

    test('does nothing to a merge request that is already in review', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createForkItem({ state: 'opened', draft: false }));

      await updateForkStatus(pullRequest, 'pending_review');

      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });
  });
});
