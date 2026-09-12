import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchBlobText } from '$lib/services/backends/git/github/files';
import {
  createPullRequest,
  deleteBranch,
  fetchPullRequestFileList,
  fetchPullRequestFiles,
  reopenPullRequest,
  updateDraftState,
  updateLabels,
} from '$lib/services/backends/git/github/pull-requests';
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

describe('GitHub pull request helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockStores();
    vi.mocked(fetchAPI).mockResolvedValue({});
    vi.mocked(fetchGraphQL).mockResolvedValue({});
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

    test('re-fetches a truncated blob with the REST API', async () => {
      const pullRequest = /** @type {any} */ ({
        branch: 'cms/posts/hello',
        files: [
          { path: 'content/posts/large.md', sha: '', size: 0, deleted: false },
          { path: 'content/posts/small.md', sha: '', size: 0, deleted: false },
          { path: 'static/large.png', sha: '', size: 0, deleted: false },
        ],
      });

      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          file_0: {
            oid: 'sha1',
            byteSize: 543840,
            isBinary: false,
            isTruncated: true,
            text: 'Cut short at 512 KB',
          },
          file_1: {
            oid: 'sha2',
            byteSize: 7,
            isBinary: false,
            isTruncated: false,
            text: '# Hello',
          },
          // A binary file has no text to complete
          file_2: {
            oid: 'sha3',
            byteSize: 999999,
            isBinary: true,
            isTruncated: true,
            text: null,
          },
        },
      });

      vi.mocked(fetchBlobText).mockResolvedValue('Complete content of large.md');

      await fetchPullRequestFiles([pullRequest]);

      expect(fetchBlobText).toHaveBeenCalledOnce();
      expect(fetchBlobText).toHaveBeenCalledWith({ owner: 'owner', repo: 'repo', sha: 'sha1' });
      expect(pullRequest.files[0].text).toBe('Complete content of large.md');
      expect(pullRequest.files[1].text).toBe('# Hello');
      expect(pullRequest.files[2].text).toBeUndefined();
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

  describe('Open Authoring', () => {
    /** The fork every test in this block writes to. */
    const fork = { owner: 'contributor', repo: 'repo' };

    beforeEach(() => {
      mockStores({ fork });
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

    describe('reopenPullRequest', () => {
      test('reopens the pull request on the configured repository', async () => {
        await reopenPullRequest(/** @type {any} */ ({ number: 7 }));

        expect(fetchAPI).toHaveBeenCalledWith('/repos/owner/repo/pulls/7', {
          method: 'PATCH',
          body: { state: 'open' },
        });
      });
    });
  });
});
