import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { commitChanges } from '$lib/services/backends/git/gitlab/commits';
import gitlabWorkflow, {
  createPullRequest,
  deleteBranch,
  discard,
  fetchMergeRequestFileContents,
  fetchMergeRequestFileList,
  fetchPullRequests,
  parseMergeRequest,
  publish,
  savePullRequest,
  stripDraftPrefix,
  updateStatus,
} from '$lib/services/backends/git/gitlab/workflow';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';

vi.mock('$lib/services/backends/git/gitlab/commits');
vi.mock('$lib/services/backends/git/gitlab/repository', () => ({
  repository: { owner: 'group/sub', repo: 'project', branch: 'main' },
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { subscribe: vi.fn() } }));
vi.mock('svelte/store', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  get: vi.fn(),
}));

const PROJECT_ID = encodeURIComponent('group/sub/project');
/**
 * Get the request body passed to the given `fetchAPI` call.
 * @param {number} [index] Call index.
 * @returns {any} Request body.
 */
const getRequestBody = (index = 0) => vi.mocked(fetchAPI).mock.calls[index][1]?.body;

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
  sha: 'abc123',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  author: { id: 7, name: 'Me', username: 'me' },
  labels: ['sveltia-cms/draft'],
  ...overrides,
});

describe('GitLab Editorial Workflow service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(get).mockReturnValue({ backend: { name: 'gitlab' } });
    vi.mocked(fetchAPI).mockResolvedValue({});
    vi.mocked(fetchGraphQL).mockResolvedValue({});
  });

  test('exports the expected service structure', () => {
    expect(gitlabWorkflow).toEqual({
      fetchPullRequests: expect.any(Function),
      savePullRequest: expect.any(Function),
      updateStatus: expect.any(Function),
      publish: expect.any(Function),
      discard: expect.any(Function),
    });
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

    test('returns undefined without a CMS label', () => {
      expect(parseMergeRequest(createItem({ labels: ['bug'] }))).toBeUndefined();
      expect(parseMergeRequest(createItem({ labels: undefined }))).toBeUndefined();
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

    test('marks a file as deleted when the blob is missing', async () => {
      const mergeRequest = /** @type {any} */ ({
        branch: 'cms/posts/hello',
        files: [{ path: 'content/posts/hello.md', sha: '', size: 0, deleted: false }],
      });

      vi.mocked(fetchGraphQL).mockResolvedValue({});
      await fetchMergeRequestFileContents(mergeRequest);

      expect(mergeRequest.files[0].deleted).toBe(true);
    });
  });

  describe('fetchPullRequests', () => {
    /**
     * Mock the REST API, returning the given merge requests for each status label.
     * @param {Record<string, any[]>} byLabel Merge request items keyed by status label.
     */
    const mockList = (byLabel) => {
      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path.includes('/diffs')) {
          return [{ new_path: 'content/posts/hello.md' }];
        }

        const [, label] = path.match(/[?&]labels=([^&]+)/) ?? [];

        return byLabel[decodeURIComponent(label ?? '')] ?? [];
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
  });

  describe('deleteBranch', () => {
    test('deletes the branch with an encoded name', async () => {
      await deleteBranch('cms/posts/hello');

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/repository/branches/cms%2Fposts%2Fhello`,
        { method: 'DELETE', responseType: 'raw' },
      );
    });

    test('ignores a failure', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Not found'));
      await expect(deleteBranch('cms/posts/hello')).resolves.toBeUndefined();
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
  });

  describe('savePullRequest', () => {
    const args = /** @type {any} */ ({
      changes: [],
      options: { commitType: 'create' },
      branch: 'cms/posts/hello',
      title: 'Create Post “hello”',
    });

    test('lets the commit create the branch on the first save', async () => {
      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });
      vi.mocked(fetchAPI).mockResolvedValueOnce({
        id: 900,
        iid: 5,
        web_url: 'u',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      const result = await savePullRequest(args);

      expect(commitChanges).toHaveBeenCalledWith([], {
        commitType: 'create',
        branch: 'cms/posts/hello',
        startBranch: 'main',
      });

      // Only the merge request is created here; the branch comes with the commit
      expect(fetchAPI).toHaveBeenCalledTimes(1);
      expect(fetchAPI).toHaveBeenCalledWith(`/projects/${PROJECT_ID}/merge_requests`, {
        method: 'POST',
        body: expect.objectContaining({ source_branch: 'cms/posts/hello' }),
      });

      expect(result.pullRequest.number).toBe(5);
    });

    test('reuses an existing merge request without creating a branch', async () => {
      const pullRequest = /** @type {any} */ ({ number: 5, branch: 'cms/posts/hello' });

      vi.mocked(commitChanges).mockResolvedValue({ sha: 'def', files: {} });

      const result = await savePullRequest({ ...args, pullRequest });

      expect(fetchAPI).not.toHaveBeenCalled();
      expect(commitChanges).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ startBranch: undefined }),
      );

      expect(result.pullRequest).toBe(pullRequest);
    });
  });

  describe('updateStatus', () => {
    const pullRequest = /** @type {any} */ ({
      number: 1,
      title: 'Create Post “hello”',
      status: 'draft',
    });

    test('removes the draft prefix and swaps the label', async () => {
      const result = await updateStatus(pullRequest, 'pending_publish');

      expect(fetchAPI).toHaveBeenCalledWith(`/projects/${PROJECT_ID}/merge_requests/1`, {
        method: 'PUT',
        body: {
          title: 'Create Post “hello”',
          add_labels: 'sveltia-cms/pending_publish',
          remove_labels: expect.stringContaining('sveltia-cms/draft'),
        },
      });

      // The new label must not be in the removal list
      expect(getRequestBody().remove_labels).not.toContain('sveltia-cms/pending_publish');

      expect(result.status).toBe('pending_publish');
    });

    test('adds the draft prefix when going back to the draft status', async () => {
      await updateStatus({ ...pullRequest, status: 'pending_review' }, 'draft');

      expect(getRequestBody().title).toBe('Draft: Create Post “hello”');
    });

    test('removes the Netlify/Decap CMS labels as well', async () => {
      await updateStatus(pullRequest, 'pending_review');

      const { remove_labels: removeLabels } = getRequestBody();

      expect(removeLabels).toContain('decap-cms/draft');
      expect(removeLabels).toContain('netlify-cms/draft');
    });
  });

  describe('publish', () => {
    test('merges the merge request and deletes the branch', async () => {
      await publish(
        /** @type {any} */ ({ number: 1, branch: 'cms/posts/hello', title: 'Create Post' }),
      );

      expect(fetchAPI).toHaveBeenNthCalledWith(
        1,
        `/projects/${PROJECT_ID}/merge_requests/1/merge`,
        {
          method: 'PUT',
          body: {
            squash: false,
            should_remove_source_branch: true,
            merge_commit_message: 'Create Post',
          },
        },
      );

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        `/projects/${PROJECT_ID}/repository/branches/cms%2Fposts%2Fhello`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    test('uses a squash merge when configured', async () => {
      vi.mocked(get).mockReturnValue({ backend: { name: 'gitlab', squash_merges: true } });

      await publish(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello', title: 't' }));

      expect(getRequestBody()).toEqual({
        squash: true,
        should_remove_source_branch: true,
        squash_commit_message: 't',
      });
    });

    test('falls back to a regular merge without the config', async () => {
      vi.mocked(get).mockReturnValue(undefined);

      await publish(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello', title: 't' }));

      expect(getRequestBody().squash).toBe(false);
    });
  });

  describe('discard', () => {
    test('closes the merge request and deletes the branch', async () => {
      await discard(/** @type {any} */ ({ number: 1, branch: 'cms/posts/hello' }));

      expect(fetchAPI).toHaveBeenNthCalledWith(1, `/projects/${PROJECT_ID}/merge_requests/1`, {
        method: 'PUT',
        body: { state_event: 'close' },
      });

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        `/projects/${PROJECT_ID}/repository/branches/cms%2Fposts%2Fhello`,
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
