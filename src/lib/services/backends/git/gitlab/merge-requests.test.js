import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  createPullRequest,
  deleteBranch,
  fetchBranchHead,
  fetchMergeRequestFileContents,
  fetchMergeRequestFileList,
  fetchOpenMergeRequests,
  fetchPullRequests,
  parseMergeRequest,
  stripDraftPrefix,
} from '$lib/services/backends/git/gitlab/merge-requests';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn() }));
vi.mock('$lib/services/backends/git/gitlab/commits');
vi.mock('$lib/services/backends/git/gitlab/fork', () => ({
  /**
   * Resolve the project that holds the workflow branches, as the real module does.
   * @returns {any} Fork, or the configured project.
   */
  getWorkflowRepository: () => forkedRepository.current ?? { owner: 'group/sub', repo: 'project' },
  projectIds: { base: 42 },
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
vi.mock('$lib/services/workflow/open-authoring', () => ({
  forkedRepository: { current: undefined },
}));

const PROJECT_ID = encodeURIComponent('group/sub/project');

/**
 * Create a raw merge request as returned by the REST API.
 * @param {object} [overrides] Properties to override.
 * @returns {any} Merge request.
 */
const createItem = (overrides = {}) => ({
  id: 900,
  iid: 1,
  title: 'Draft: Create Post “hello”',
  web_url: 'https://gitlab.com/group/sub/project/-/merge_requests/1',
  source_branch: 'cms/posts/hello',
  target_branch: 'main',
  sha: 'abc123',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  author: { id: 7, name: 'Me', username: 'me' },
  labels: ['sveltia-cms/draft'],
  ...overrides,
});

describe('GitLab merge requests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitlab' } });
    forkedRepository.current = undefined;
    vi.mocked(fetchAPI).mockResolvedValue({});
    vi.mocked(fetchGraphQL).mockResolvedValue({});
  });

  describe('stripDraftPrefix', () => {
    test.each([
      ['Draft: Title', 'Title'],
      ['draft: Title', 'Title'],
      ['[Draft] Title', 'Title'],
      ['(Draft) Title', 'Title'],
      ['WIP: Title', 'Title'],
      ['[WIP] Title', 'Title'],
      ['Draft: WIP: Title', 'Title'],
      ['Title', 'Title'],
      ['Drafting the plan', 'Drafting the plan'],
    ])('strips %s', (input, expected) => {
      expect(stripDraftPrefix(input)).toBe(expected);
    });
  });

  describe('parseMergeRequest', () => {
    test('parses a CMS-managed merge request', () => {
      expect(parseMergeRequest(createItem())).toEqual({
        number: 1,
        nodeId: '900',
        title: 'Create Post “hello”',
        url: 'https://gitlab.com/group/sub/project/-/merge_requests/1',
        branch: 'cms/posts/hello',
        headSHA: 'abc123',
        status: 'draft',
        createdDate: new Date('2026-01-01T00:00:00Z'),
        updatedDate: new Date('2026-01-02T00:00:00Z'),
        author: { name: 'Me', email: '', id: 7, login: 'me' },
        files: [],
      });
    });

    test('returns undefined for a merge request to another branch', () => {
      // One whose target branch was changed on GitLab after the CMS opened it, or one labelled
      // by hand. Listing it would move the label on someone else’s request, and publish the entry
      // into that other branch
      expect(parseMergeRequest(createItem({ target_branch: 'develop' }))).toBeUndefined();
    });

    test('returns undefined without a CMS label', () => {
      expect(parseMergeRequest(createItem({ labels: ['bug'] }))).toBeUndefined();
      expect(parseMergeRequest(createItem({ labels: undefined }))).toBeUndefined();
    });

    test('returns undefined for a merge request from a fork', () => {
      // Its source branch lives in the fork, so reading, merging or deleting a branch of that name
      // on the configured project would act on something else
      expect(
        parseMergeRequest(createItem({ source_project_id: 2, target_project_id: 1 })),
      ).toBeUndefined();
      expect(
        parseMergeRequest(createItem({ source_project_id: 1, target_project_id: 1 })),
      ).toBeDefined();
    });

    test('picks up a merge request created with Netlify/Decap CMS', () => {
      expect(parseMergeRequest(createItem({ labels: ['decap-cms/pending_review'] }))?.status).toBe(
        'pending_review',
      );
    });

    test('handles a missing author and one without a display name', () => {
      expect(parseMergeRequest(createItem({ author: null }))?.author).toBeUndefined();

      expect(parseMergeRequest(createItem({ author: { username: 'bot' } }))?.author).toEqual({
        name: 'bot',
        email: '',
        id: undefined,
        login: 'bot',
      });
    });
  });

  describe('fetchMergeRequestFileList', () => {
    test('maps the diffs to workflow files', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([
        { new_path: 'content/posts/hello.md', old_path: 'content/posts/hello.md' },
        { new_path: 'content/posts/old.md', old_path: 'content/posts/old.md', deleted_file: true },
      ]);

      const mergeRequest = /** @type {any} */ ({ number: 1, files: [] });

      await fetchMergeRequestFileList(mergeRequest);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/merge_requests/1/diffs?per_page=100`,
      );

      expect(mergeRequest.files).toEqual([
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
      ]);
    });

    test('keeps the path a rename came from', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([
        {
          new_path: 'content/posts/renamed.md',
          old_path: 'content/posts/hello.md',
          renamed_file: true,
        },
      ]);

      const mergeRequest = /** @type {any} */ ({ number: 1, files: [] });

      await fetchMergeRequestFileList(mergeRequest);

      expect(mergeRequest.files[0]).toEqual({
        path: 'content/posts/renamed.md',
        sha: '',
        size: 0,
        deleted: false,
        previousPath: 'content/posts/hello.md',
      });
    });
  });

  describe('fetchMergeRequestFileContents', () => {
    test('does nothing when every file is deleted', async () => {
      await fetchMergeRequestFileContents(
        /** @type {any} */ ({ branch: 'cms/posts/hello', files: [{ deleted: true }] }),
      );

      expect(fetchGraphQL).not.toHaveBeenCalled();
    });

    test('populates the file content, matching the blobs by path', async () => {
      const mergeRequest = /** @type {any} */ ({
        branch: 'cms/posts/hello',
        files: [
          { path: 'content/posts/hello.md', sha: '', size: 0, deleted: false },
          { path: 'static/img.png', sha: '', size: 0, deleted: false },
        ],
      });

      vi.mocked(fetchGraphQL).mockResolvedValue({
        project: {
          repository: {
            blobs: {
              nodes: [
                // Returned out of order, to make sure the mapping is by path rather than by index
                { path: 'static/img.png', oid: 'sha2', size: null, rawTextBlob: null },
                { path: 'content/posts/hello.md', oid: 'sha1', size: '7', rawTextBlob: '# Hello' },
              ],
            },
          },
        },
      });

      await fetchMergeRequestFileContents(mergeRequest);

      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('blobs'), {
        fullPath: 'group/sub/project',
        branch: 'cms/posts/hello',
        paths: ['content/posts/hello.md', 'static/img.png'],
      });

      expect(mergeRequest.files[0]).toEqual({
        path: 'content/posts/hello.md',
        sha: 'sha1',
        size: 7,
        text: '# Hello',
        deleted: false,
      });

      // A binary blob has no text, and GitLab may omit the size
      expect(mergeRequest.files[1]).toEqual({
        path: 'static/img.png',
        sha: 'sha2',
        size: 0,
        text: undefined,
        deleted: false,
      });
    });

    test('reads the files at the head commit when there is one', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        project: { repository: { blobs: { nodes: [] } } },
      });

      await fetchMergeRequestFileContents(
        /** @type {any} */ ({
          branch: 'cms/posts/hello',
          headSHA: 'abc123',
          files: [{ path: 'content/posts/hello.md', sha: '', size: 0, deleted: false }],
        }),
      );

      // The content shown is that of the commit a publish is pinned to, even if the branch has
      // moved on since the merge request was listed
      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('blobs'), {
        fullPath: 'group/sub/project',
        branch: 'abc123',
        paths: ['content/posts/hello.md'],
      });
    });

    test('marks a file as deleted when the blob is missing', async () => {
      const mergeRequest = /** @type {any} */ ({
        branch: 'cms/posts/hello',
        files: [{ path: 'content/posts/hello.md', sha: '', size: 0, deleted: false }],
      });

      // GitLab omits the node of a path it can’t resolve, rather than returning a null one
      vi.mocked(fetchGraphQL).mockResolvedValue({
        project: { repository: { blobs: { nodes: [] } } },
      });

      await fetchMergeRequestFileContents(mergeRequest);

      expect(mergeRequest.files[0].deleted).toBe(true);
    });
  });

  describe('fetchPullRequests', () => {
    /**
     * Mock the REST API, returning the given merge requests for each status label.
     * @param {Record<string, any[]>} byLabel Merge request items keyed by status label.
     * @param {object} [options] Options.
     * @param {any} [options.permissions] Result of the merge permission query, or the error it
     * throws.
     */
    const mockList = (byLabel, { permissions = {} } = {}) => {
      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path.includes('/diffs')) {
          return [{ new_path: 'content/posts/hello.md' }];
        }

        const [, label] = path.match(/[?&]labels=([^&]+)/) ?? [];

        return byLabel[decodeURIComponent(label ?? '')] ?? [];
      });

      vi.mocked(fetchGraphQL).mockImplementation(async (query) => {
        if (query.includes('userPermissions')) {
          if (permissions instanceof Error) {
            throw permissions;
          }

          return permissions;
        }

        return {
          project: {
            repository: {
              blobs: {
                nodes: [
                  {
                    path: 'content/posts/hello.md',
                    oid: 'sha1',
                    size: '7',
                    rawTextBlob: '# Hello',
                  },
                ],
              },
            },
          },
        };
      });
    };

    test('asks the API for each status label, because the filter matches all of them', async () => {
      mockList({ 'sveltia-cms/draft': [createItem()] });

      const result = await fetchPullRequests();

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/merge_requests?state=opened&order_by=updated_at&per_page=100` +
          '&labels=sveltia-cms%2Fdraft',
      );

      // The legacy prefixes are searched as well
      expect(fetchAPI).toHaveBeenCalledWith(expect.stringContaining('labels=decap-cms%2Fdraft'));

      expect(result).toHaveLength(1);
      expect(result[0].files[0].text).toBe('# Hello');
    });

    test('skips an item the API returned without a CMS label', async () => {
      mockList({ 'sveltia-cms/draft': [createItem({ iid: 2, labels: ['bug'] })] });

      await expect(fetchPullRequests()).resolves.toEqual([]);
    });

    test('skips a merge request from a fork', async () => {
      mockList({
        'sveltia-cms/draft': [
          createItem({ source_project_id: 1, target_project_id: 1 }),
          createItem({ iid: 2, source_project_id: 2, target_project_id: 1 }),
        ],
      });

      const result = await fetchPullRequests();

      expect(result.map(({ number }) => number)).toEqual([1]);
      // Nothing is read for the skipped one
      expect(fetchAPI).not.toHaveBeenCalledWith(expect.stringContaining('/merge_requests/2/'));
    });

    test('merges the results, listing a merge request found twice only once', async () => {
      // A merge request can carry status labels with more than one prefix
      mockList({
        'sveltia-cms/draft': [createItem()],
        'decap-cms/draft': [createItem()],
        'sveltia-cms/pending_publish': [createItem({ iid: 2, updated_at: '2026-01-03T00:00:00Z' })],
      });

      const result = await fetchPullRequests();

      // Sorted by the last update, newest first
      expect(result.map(({ number }) => number)).toEqual([2, 1]);
    });

    test('asks whether the user can merge each merge request, all at once', async () => {
      mockList(
        {
          'sveltia-cms/pending_publish': [
            createItem(),
            createItem({ iid: 2 }),
            createItem({ iid: 3 }),
          ],
        },
        {
          permissions: {
            project: {
              mergeRequests: {
                nodes: [
                  { iid: '1', userPermissions: { canMerge: true } },
                  { iid: '2', userPermissions: { canMerge: false } },
                  // A merge request the query didn’t match is left alone
                  { iid: '9', userPermissions: { canMerge: false } },
                ],
              },
            },
          },
        },
      );

      const result = await fetchPullRequests();
      const canMerge = Object.fromEntries(result.map((mr) => [mr.number, mr.canMerge]));

      expect(canMerge).toEqual({ 1: true, 2: false, 3: undefined });
      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('canMerge'), {
        iids: ['1', '2', '3'],
      });
    });

    test('asks about 100 merge requests at a time', async () => {
      const items = Array.from({ length: 150 }, (_, index) => createItem({ iid: index + 1 }));

      mockList({ 'sveltia-cms/draft': items.slice(0, 100), 'decap-cms/draft': items.slice(100) });

      await fetchPullRequests();

      const calls = vi
        .mocked(fetchGraphQL)
        .mock.calls.filter(([query]) => query.includes('userPermissions'));

      expect(calls.map(([, variables]) => variables?.iids.length)).toEqual([100, 50]);
    });

    test('leaves the permissions unknown when the query fails', async () => {
      mockList(
        { 'sveltia-cms/pending_publish': [createItem()] },
        { permissions: new Error('Field doesn’t exist') },
      );

      const [mergeRequest] = await fetchPullRequests();

      expect(mergeRequest.canMerge).toBeUndefined();
      expect(mergeRequest.files[0].text).toBe('# Hello');
    });
  });

  describe('fetchBranchHead', () => {
    test('reads the commit the branch points at', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ commit: { id: 'abc123' } });

      await expect(fetchBranchHead('cms/posts/hello')).resolves.toBe('abc123');

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/repository/branches/cms%2Fposts%2Fhello`,
      );
    });

    test('reads an Open Authoring branch from the fork it lives in', async () => {
      forkedRepository.current = /** @type {any} */ ({ owner: 'contributor', repo: 'project' });
      vi.mocked(fetchAPI).mockResolvedValue({ commit: { id: 'abc123' } });

      const branch = 'cms/contributor/project/posts/hello';

      await expect(fetchBranchHead(branch)).resolves.toBe('abc123');

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/contributor%2Fproject/repository/branches/${encodeURIComponent(branch)}`,
      );
    });

    test('answers undefined for a branch that is gone', async () => {
      // A merge request merged or closed outside the CMS leaves no branch behind
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', { cause: { status: 404 } }),
      );

      await expect(fetchBranchHead('cms/posts/hello')).resolves.toBeUndefined();
    });

    test('raises any other failure, rather than taking the branch for gone', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', { cause: { status: 500 } }),
      );

      await expect(fetchBranchHead('cms/posts/hello')).rejects.toThrow();
    });
  });

  describe('deleteBranch', () => {
    test('deletes the branch with an encoded name', async () => {
      await deleteBranch('cms/posts/hello');

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/repository/branches/cms%2Fposts%2Fhello`,
        // Not `raw`, which would hand an error response back instead of throwing it
        { method: 'DELETE', responseType: 'text' },
      );
    });

    test('ignores a failure, but logs it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.mocked(fetchAPI).mockRejectedValue(new Error('Error', { cause: { status: 500 } }));
      await expect(deleteBranch('cms/posts/hello')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledOnce();
      warn.mockRestore();
    });

    test('ignores a branch that is already gone without logging it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      vi.mocked(fetchAPI).mockRejectedValue(new Error('Error', { cause: { status: 404 } }));
      await expect(deleteBranch('cms/posts/hello')).resolves.toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('Open Authoring', () => {
    const FORK = { owner: 'contributor', repo: 'project' };
    const FORK_ID = encodeURIComponent('contributor/project');

    beforeEach(() => {
      forkedRepository.current = /** @type {any} */ (FORK);
    });

    test('reads the blobs from the fork', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        project: { repository: { blobs: { nodes: [] } } },
      });

      await fetchMergeRequestFileContents(
        /** @type {any} */ ({
          branch: 'cms/contributor/project/posts/hello',
          files: [{ path: 'content/posts/hello.md', deleted: false }],
        }),
      );

      expect(fetchGraphQL).toHaveBeenCalledWith(
        expect.stringContaining('blobs'),
        expect.objectContaining({ fullPath: 'contributor/project' }),
      );
    });

    test('deletes the branch from the fork', async () => {
      await deleteBranch('cms/contributor/project/posts/hello');

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${FORK_ID}/repository/branches/cms%2Fcontributor%2Fproject%2Fposts%2Fhello`,
        { method: 'DELETE', responseType: 'text' },
      );
    });

    test('opens the merge request from the fork, without a label', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        id: 900,
        iid: 5,
        web_url: 'u',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      await createPullRequest({
        branch: 'cms/contributor/project/posts/hello',
        title: 'Create Post “hello”',
        status: 'pending_review',
      });

      expect(fetchAPI).toHaveBeenCalledWith(`/projects/${FORK_ID}/merge_requests`, {
        method: 'POST',
        body: expect.objectContaining({
          title: 'Create Post “hello”',
          target_project_id: 42,
          allow_collaboration: true,
        }),
      });

      // Labelling needs write access to the configured project, which a contributor lacks
      expect(vi.mocked(fetchAPI).mock.calls[0][1]?.body).not.toHaveProperty('labels');
    });
  });

  describe('createPullRequest', () => {
    test('creates a draft merge request with the draft label', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        id: 900,
        iid: 5,
        web_url: 'https://gitlab.com/group/sub/project/-/merge_requests/5',
        sha: 'abc123',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      const result = await createPullRequest({
        branch: 'cms/posts/hello',
        title: 'Create Post “hello”',
        status: 'draft',
      });

      expect(fetchAPI).toHaveBeenCalledWith(`/projects/${PROJECT_ID}/merge_requests`, {
        method: 'POST',
        body: expect.objectContaining({
          title: 'Draft: Create Post “hello”',
          source_branch: 'cms/posts/hello',
          target_branch: 'main',
          labels: 'sveltia-cms/draft',
          remove_source_branch: true,
        }),
      });

      // The stored title excludes the draft prefix
      expect(result).toEqual(
        expect.objectContaining({
          number: 5,
          nodeId: '900',
          title: 'Create Post “hello”',
          headSHA: 'abc123',
          status: 'draft',
          files: [],
        }),
      );
    });

    test('tells whether the user can merge the new merge request', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        id: 900,
        iid: 5,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        user: { can_merge: false },
      });

      const result = await createPullRequest({
        branch: 'cms/posts/hello',
        title: 'Create Post “hello”',
        status: 'draft',
      });

      expect(result.canMerge).toBe(false);
    });

    test('keeps a title starting with a draft indicator, and reports the author', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        id: 900,
        iid: 5,
        title: 'WIP: notes',
        source_branch: 'cms/posts/wip',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        author: { id: 1, name: 'Alice', username: 'alice' },
      });

      const result = await createPullRequest({
        branch: 'cms/posts/wip',
        title: 'WIP: notes',
        status: 'pending_review',
      });

      expect(result).toEqual(
        expect.objectContaining({
          title: 'WIP: notes',
          branch: 'cms/posts/wip',
          status: 'pending_review',
          author: { name: 'Alice', email: '', id: 1, login: 'alice' },
        }),
      );
    });
  });

  describe('fetchOpenMergeRequests', () => {
    /**
     * Create a raw merge request from a branch of this project.
     * @param {object} [overrides] Properties to override.
     * @returns {any} Merge request.
     */
    const createOwnItem = (overrides = {}) =>
      createItem({
        iid: 7,
        source_project_id: 1,
        target_project_id: 1,
        target_branch: 'main',
        ...overrides,
      });

    test('returns the merge requests from the branch, whichever branch they go to', async () => {
      const items = [createOwnItem(), createOwnItem({ iid: 8, target_branch: 'develop' })];

      vi.mocked(fetchAPI).mockResolvedValue(items);

      await expect(fetchOpenMergeRequests('cms/posts/hello')).resolves.toEqual(items);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/merge_requests` +
          '?state=opened&source_branch=cms%2Fposts%2Fhello&per_page=100',
      );
    });

    test('encodes the branch name', async () => {
      // Left as is, `#` would start a fragment and the query would be dropped, so the request would
      // ask about every open merge request from `cms/posts/c`
      vi.mocked(fetchAPI).mockResolvedValue([]);

      await expect(fetchOpenMergeRequests('cms/posts/c#-tips')).resolves.toEqual([]);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/merge_requests` +
          '?state=opened&source_branch=cms%2Fposts%2Fc%23-tips&per_page=100',
      );
    });

    test('skips a merge request from a fork', async () => {
      // A fork can have a source branch of the same name, but its merge request isn’t this
      // branch’s, and deleting this branch doesn’t touch it
      vi.mocked(fetchAPI).mockResolvedValue([
        createItem({ iid: 7, source_project_id: 2, target_project_id: 1, target_branch: 'main' }),
      ]);

      await expect(fetchOpenMergeRequests('cms/posts/hello')).resolves.toEqual([]);
    });
  });
});
