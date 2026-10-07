import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchRawFile } from '$lib/services/backends/git/gitea/files';
import {
  applyLabels,
  createPullRequest,
  createStatusLabel,
  decodeFileText,
  deleteBranch,
  fetchAllPages,
  fetchBranchHead,
  fetchFileSHA,
  fetchPages,
  fetchPullRequestFileContent,
  fetchPullRequestFileContents,
  fetchPullRequestFileList,
  fetchPullRequestHeadRef,
  parsePullRequest,
  resetPageSize,
  resolveChangeSHAs,
  stripWipPrefix,
  updateDraftState,
  updateLabels,
} from '$lib/services/backends/git/gitea/pull-requests';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { forkedRepository } from '$lib/services/workflow/open-authoring';

vi.mock('$lib/services/backends/git/gitea/files');
vi.mock('$lib/services/backends/git/gitea/repository', () => ({
  repository: { owner: 'owner', repo: 'repo', branch: 'main' },
}));
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

describe('Gitea pull request service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetPageSize();
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitea' } });
    forkedRepository.current = undefined;
    vi.mocked(fetchAPI).mockResolvedValue({});
  });

  describe('fetchAllPages', () => {
    test('reads every page at the size the instance applies', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ max_response_items: 2 })
        .mockResolvedValueOnce([1, 2])
        .mockResolvedValueOnce([3, 4])
        .mockResolvedValueOnce([5]);

      await expect(fetchAllPages(`${REPO_PATH}/branches`)).resolves.toEqual([1, 2, 3, 4, 5]);

      expect(fetchAPI).toHaveBeenNthCalledWith(1, '/settings/api');
      expect(fetchAPI).toHaveBeenNthCalledWith(2, `${REPO_PATH}/branches?page=1&limit=2`);
      expect(fetchAPI).toHaveBeenNthCalledWith(4, `${REPO_PATH}/branches?page=3&limit=2`);
    });

    test('asks for the page size once, and falls back to the default', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({}).mockResolvedValue([]);

      await fetchAllPages(`${REPO_PATH}/pulls?state=open`);
      await fetchAllPages(`${REPO_PATH}/pulls?state=open`);

      expect(fetchAPI).toHaveBeenCalledTimes(3);
      // The parameters are appended to the ones the path already has
      expect(fetchAPI).toHaveBeenLastCalledWith(`${REPO_PATH}/pulls?state=open&page=1&limit=50`);
    });

    test('stops after a bounded number of pages', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({ max_response_items: 1 }).mockResolvedValue(['x']);

      const result = await fetchAllPages(`${REPO_PATH}/branches`);

      expect(result).toHaveLength(10);
      expect(fetchAPI).toHaveBeenCalledTimes(11);
    });
  });

  describe('fetchPages', () => {
    test('says whether the list was read to the end', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ max_response_items: 2 })
        .mockResolvedValueOnce([1, 2])
        .mockResolvedValueOnce([3]);

      await expect(fetchPages(`${REPO_PATH}/pulls/1/files`)).resolves.toEqual({
        items: [1, 2, 3],
        complete: true,
      });
    });

    test('says so when the page cap cut the list short', async () => {
      vi.mocked(fetchAPI).mockResolvedValueOnce({ max_response_items: 1 }).mockResolvedValue(['x']);

      await expect(fetchPages(`${REPO_PATH}/pulls/1/files`)).resolves.toMatchObject({
        complete: false,
      });
    });
  });

  describe('stripWipPrefix', () => {
    test.each([
      ['WIP: Title', 'Title'],
      ['wip: Title', 'Title'],
      ['[WIP] Title', 'Title'],
      ['[wip] Title', 'Title'],
      ['WIP: [WIP] Title', 'Title'],
      ['Title', 'Title'],
      ['Wiping the slate', 'Wiping the slate'],
    ])('strips %s', (input, expected) => {
      expect(stripWipPrefix(input)).toBe(expected);
    });
  });

  describe('parsePullRequest', () => {
    test('parses a CMS-managed pull request', () => {
      expect(parsePullRequest(createItem())).toEqual({
        number: 1,
        nodeId: '900',
        title: 'Create Post “hello”',
        url: 'https://gitea.com/owner/repo/pulls/1',
        branch: 'cms/posts/hello',
        headSHA: 'abc123',
        status: 'draft',
        createdDate: new Date('2026-01-01T00:00:00Z'),
        updatedDate: new Date('2026-01-02T00:00:00Z'),
        author: { name: 'Me', email: 'me@example.com', id: 7, login: 'me' },
        files: [],
      });
    });

    test('returns undefined without a CMS label', () => {
      expect(parsePullRequest(createItem({ labels: [{ name: 'bug' }] }))).toBeUndefined();
      expect(parsePullRequest(createItem({ labels: undefined }))).toBeUndefined();
    });

    test('picks up a pull request created with Netlify/Decap CMS', () => {
      expect(
        parsePullRequest(createItem({ labels: [{ name: 'decap-cms/pending_review' }] }))?.status,
      ).toBe('pending_review');
    });

    test('skips a pull request from a fork', () => {
      // Its branch is in a repository this flow can’t read, so the board would show the configured
      // repository’s branch of the same name while publishing merged the fork’s commits
      expect(
        parsePullRequest(
          createItem({
            head: { ref: 'cms/posts/hello', sha: 'abc123', repo_id: 2 },
          }),
        ),
      ).toBeUndefined();
    });

    test('skips a pull request to another branch', () => {
      // One whose base branch was changed after the CMS opened it, or one labelled by hand
      expect(
        parsePullRequest(createItem({ base: { ref: 'develop', repo_id: 1 } })),
      ).toBeUndefined();
    });

    test('skips a pull request whose head branch is gone', () => {
      expect(parsePullRequest(createItem({ head: undefined }))).toBeUndefined();
    });

    test('skips a pull request whose origin the instance doesn’t report', () => {
      // The head repository is left out once it has been deleted, and its ID is `-1` until one is
      // resolved. Either way there’s nothing to establish the branch is the configured
      // repository’s, so it’s treated as a fork rather than taken on trust
      expect(parsePullRequest(createItem({ head: { ref: 'cms/posts/hello' } }))).toBeUndefined();

      expect(
        parsePullRequest(createItem({ head: { ref: 'cms/posts/hello', repo_id: -1 } })),
      ).toBeUndefined();

      expect(
        parsePullRequest(createItem({ head: { ref: 'cms/posts/hello', repo_id: 1 }, base: {} })),
      ).toBeUndefined();
    });

    test('handles a missing author and one without a display name', () => {
      expect(parsePullRequest(createItem({ user: null }))?.author).toBeUndefined();

      expect(parsePullRequest(createItem({ user: { login: 'bot' } }))?.author).toEqual({
        name: 'bot',
        email: '',
        id: undefined,
        login: 'bot',
      });
    });
  });

  describe('fetchPullRequestFileList', () => {
    test('maps the changed files to workflow files', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([
        { filename: 'content/posts/hello.md', status: 'changed' },
        { filename: 'content/posts/old.md', status: 'deleted' },
        {
          filename: 'content/posts/renamed.md',
          status: 'renamed',
          previous_filename: 'content/posts/hello.md',
        },
      ]);

      const pullRequest = /** @type {any} */ ({ number: 1, files: [] });

      await fetchPullRequestFileList(pullRequest);

      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/pulls/1/files?page=1&limit=50`);

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
          previousPath: 'content/posts/hello.md',
        },
      ]);
    });

    describe('with a head commit on record', () => {
      /** @type {any} */
      let pullRequest;

      /**
       * Create a changed file listed at the given commit.
       * @param {string} filename File path.
       * @param {string} ref Commit the file was listed at.
       * @returns {any} Changed file.
       */
      const listed = (filename, ref) => ({
        filename,
        status: 'added',
        contents_url: `https://gitea.com/api/v1${REPO_PATH}/contents/${filename}?ref=${ref}`,
      });

      beforeEach(() => {
        pullRequest = { number: 1, headSHA: 'head1', files: [] };
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      test('waits for the list to describe the head commit', async () => {
        // The instance hasn’t caught up with the push that added the asset yet
        vi.mocked(fetchAPI)
          .mockResolvedValueOnce({ max_response_items: 50 })
          .mockResolvedValueOnce([listed('content/posts/hello.md', 'head0')])
          .mockResolvedValueOnce([
            listed('content/posts/hello.md', 'head1'),
            listed('static/images/new.svg', 'head1'),
          ]);

        const promise = fetchPullRequestFileList(pullRequest);

        await vi.runAllTimersAsync();
        await promise;

        expect(pullRequest.files.map((/** @type {any} */ { path }) => path)).toEqual([
          'content/posts/hello.md',
          'static/images/new.svg',
        ]);
        expect(pullRequest.headSHA).toBe('head1');
      });

      test('shows the list as it stands once the wait runs out', async () => {
        vi.mocked(fetchAPI)
          .mockResolvedValueOnce({ max_response_items: 50 })
          .mockResolvedValue([listed('content/posts/hello.md', 'head2')]);

        const promise = fetchPullRequestFileList(pullRequest);

        await vi.runAllTimersAsync();
        await promise;

        expect(pullRequest.files.map((/** @type {any} */ { path }) => path)).toEqual([
          'content/posts/hello.md',
        ]);
        // The page size, then three reads of the list
        expect(fetchAPI).toHaveBeenCalledTimes(4);
        // The list describes another commit, which becomes the one on record: the files are read
        // at it too, and publishing is refused, as the branch points elsewhere
        expect(pullRequest.headSHA).toBe('head2');
      });

      test('leaves no head on record when the list names more than one commit', async () => {
        const pinned = /** @type {any} */ ({ number: 1, headSHA: 'head1', files: [] });

        vi.mocked(fetchAPI)
          .mockResolvedValueOnce({ max_response_items: 50 })
          .mockResolvedValue([
            listed('content/posts/hello.md', 'head0'),
            listed('static/images/new.svg', 'head2'),
          ]);

        const promise = fetchPullRequestFileList(pinned);

        await vi.runAllTimersAsync();
        await promise;

        expect(pinned.headSHA).toBeUndefined();
      });
    });
  });

  describe('decodeFileText', () => {
    test('decodes UTF-8 text', () => {
      expect(decodeFileText(toBase64('# Hello 👋'))).toBe('# Hello 👋');
    });

    test('returns undefined for a binary file', () => {
      expect(decodeFileText(Uint8Array.from([0x89, 0x50, 0xff, 0xfe]).toBase64())).toBeUndefined();
    });
  });

  describe('fetchPullRequestFileContent', () => {
    const pullRequest = /** @type {any} */ ({ number: 1, branch: 'cms/posts/hello' });

    test('populates the blob metadata and the text', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        sha: 'sha1',
        size: 7,
        content: toBase64('# Hello'),
        encoding: 'base64',
      });

      const file = /** @type {any} */ ({
        path: 'content/posts/hello.md',
        sha: '',
        size: 0,
        deleted: false,
      });

      await fetchPullRequestFileContent(pullRequest, file);

      expect(fetchAPI).toHaveBeenCalledWith(
        `${REPO_PATH}/contents/content/posts/hello.md?ref=cms%2Fposts%2Fhello`,
      );

      expect(file).toEqual({
        path: 'content/posts/hello.md',
        sha: 'sha1',
        size: 7,
        text: '# Hello',
        deleted: false,
      });
    });

    test('keeps only the metadata of a binary file', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        sha: 'sha2',
        size: 4,
        content: Uint8Array.from([0x89, 0x50, 0xff, 0xfe]).toBase64(),
        encoding: 'base64',
      });

      const file = /** @type {any} */ ({
        path: 'static/img.png',
        sha: '',
        size: 0,
        deleted: false,
      });

      await fetchPullRequestFileContent(pullRequest, file);

      expect(file.sha).toBe('sha2');
      expect(file.text).toBeUndefined();
      expect(fetchRawFile).not.toHaveBeenCalled();
    });

    test('reads an oversized text file from the raw endpoint', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ sha: 'sha3', size: 20000000, content: null });
      vi.mocked(fetchRawFile).mockResolvedValue('# Big');

      const file = /** @type {any} */ ({ path: 'content/posts/big.md', sha: '', size: 0 });

      await fetchPullRequestFileContent(pullRequest, file);

      expect(fetchRawFile).toHaveBeenCalledWith('content/posts/big.md', 'cms/posts/hello');
      expect(file.text).toBe('# Big');
    });

    test('reads the files at the head commit, which a publish is pinned to', async () => {
      // A branch moved on while the board loads would otherwise show content other than the one
      // published, which the publish check can’t tell, since it compares the commit and the paths
      const pinned = /** @type {any} */ ({ ...pullRequest, headSHA: 'head1' });

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({
          sha: 'sha1',
          size: 7,
          content: toBase64('# Hello'),
          encoding: 'base64',
        })
        .mockResolvedValueOnce({ sha: 'sha3', size: 20000000, content: null });
      vi.mocked(fetchRawFile).mockResolvedValue('# Big');

      await fetchPullRequestFileContent(
        pinned,
        /** @type {any} */ ({ path: 'content/posts/hello.md' }),
      );
      await fetchPullRequestFileContent(
        pinned,
        /** @type {any} */ ({ path: 'content/posts/big.md' }),
      );

      expect(fetchAPI).toHaveBeenCalledWith(
        `${REPO_PATH}/contents/content/posts/hello.md?ref=head1`,
      );
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/contents/content/posts/big.md?ref=head1`);
      expect(fetchRawFile).toHaveBeenCalledWith('content/posts/big.md', 'head1');
    });

    test.each(['static/movie.mp4', 'static/archive.unknown'])(
      'leaves the oversized %s alone',
      async (path) => {
        // A file with an unrecognized extension is left alone as well, rather than being read as
        // text on the off chance that it is
        vi.mocked(fetchAPI).mockResolvedValue({ size: 20000000, content: null });

        const file = /** @type {any} */ ({ path, sha: '', size: 0 });

        await fetchPullRequestFileContent(pullRequest, file);

        expect(fetchRawFile).not.toHaveBeenCalled();
        expect(file.text).toBeUndefined();
        // The instance didn’t report a SHA either, so the file keeps an empty one
        expect(file.sha).toBe('');
      },
    );

    test('marks the file as deleted when it’s gone from the branch', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', { cause: { status: 404 } }),
      );

      const file = /** @type {any} */ ({ path: 'content/posts/hello.md', deleted: false });

      await fetchPullRequestFileContent(pullRequest, file);

      expect(file.deleted).toBe(true);
    });

    test('rethrows any other error', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', { cause: { status: 500 } }),
      );

      await expect(
        fetchPullRequestFileContent(pullRequest, /** @type {any} */ ({ path: 'a.md' })),
      ).rejects.toThrow('Server responded with an error');
    });
  });

  describe('fetchPullRequestFileContents', () => {
    test('skips the deleted files', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ sha: 'sha1', size: 0, content: '' });

      await fetchPullRequestFileContents(
        /** @type {any} */ ({
          number: 1,
          branch: 'cms/posts/hello',
          files: [{ path: 'a.md', deleted: true }, { path: 'b.md' }],
        }),
      );

      expect(fetchAPI).toHaveBeenCalledTimes(1);
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/contents/b.md?ref=cms%2Fposts%2Fhello`);
    });
  });

  describe('deleteBranch', () => {
    test('deletes the branch, keeping the slashes in its name', async () => {
      await deleteBranch('cms/posts/hello');

      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/branches/cms/posts/hello`, {
        method: 'DELETE',
        responseType: 'text',
      });
    });

    test('reports a refusal', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', { cause: { status: 403 } }),
      );

      await expect(deleteBranch('cms/posts/hello')).resolves.toBeUndefined();
      // eslint-disable-next-line no-console
      expect(console.warn).toHaveBeenCalled();
    });

    test('stays quiet when the branch is already gone', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', { cause: { status: 404 } }),
      );

      await deleteBranch('cms/posts/hello');
      // eslint-disable-next-line no-console
      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('createStatusLabel', () => {
    test('creates the label with a color of its own', async () => {
      await createStatusLabel('pending_review');

      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/labels`, {
        method: 'POST',
        body: {
          name: 'sveltia-cms/pending_review',
          color: '#fbca04',
          description: expect.any(String),
        },
      });
    });
  });

  describe('applyLabels', () => {
    test('applies the labels in one request when the label exists', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([{ name: 'sveltia-cms/draft' }]);

      await applyLabels(1, ['sveltia-cms/draft'], 'draft', 'POST');

      expect(fetchAPI).toHaveBeenCalledTimes(1);
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/issues/1/labels`, {
        method: 'POST',
        body: { labels: ['sveltia-cms/draft'] },
      });
    });

    test('creates the label and retries when the instance dropped it', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce([{ name: 'bug' }])
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce([{ name: 'bug' }, { name: 'sveltia-cms/draft' }]);

      await applyLabels(1, ['bug', 'sveltia-cms/draft'], 'draft', 'PUT');

      expect(fetchAPI).toHaveBeenNthCalledWith(2, `${REPO_PATH}/labels`, {
        method: 'POST',
        body: expect.objectContaining({ name: 'sveltia-cms/draft' }),
      });

      expect(fetchAPI).toHaveBeenNthCalledWith(3, `${REPO_PATH}/issues/1/labels`, {
        method: 'PUT',
        body: { labels: ['bug', 'sveltia-cms/draft'] },
      });
    });

    test('creates the repository’s own label when only the organization’s was applied', async () => {
      // The board lists pull requests by the IDs of the repository’s labels, so one carrying the
      // organization’s label of the same name alone would never show up there
      const orgLabel = {
        name: 'sveltia-cms/draft',
        url: 'https://gitea.com/api/v1/orgs/owner/labels/3',
      };

      const repoLabel = {
        name: 'sveltia-cms/draft',
        url: 'https://gitea.com/api/v1/repos/owner/repo/labels/9',
      };

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce([orgLabel])
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce([orgLabel, repoLabel]);

      await applyLabels(1, ['sveltia-cms/draft'], 'draft', 'POST');

      expect(fetchAPI).toHaveBeenNthCalledWith(2, `${REPO_PATH}/labels`, {
        method: 'POST',
        body: expect.objectContaining({ name: 'sveltia-cms/draft' }),
      });
      expect(fetchAPI).toHaveBeenCalledTimes(3);

      // The repository’s own label counts once it’s there
      vi.mocked(fetchAPI).mockReset();
      vi.mocked(fetchAPI).mockResolvedValue([orgLabel, repoLabel]);
      await applyLabels(1, ['sveltia-cms/draft'], 'draft', 'POST');
      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateLabels', () => {
    test('replaces the CMS label while preserving any other one', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path, options) =>
        options?.method === undefined
          ? [{ name: 'bug' }, { name: 'netlify-cms/draft' }]
          : [{ name: 'bug' }, { name: 'sveltia-cms/pending_publish' }],
      );

      await updateLabels(/** @type {any} */ ({ number: 1 }), 'pending_publish');

      expect(fetchAPI).toHaveBeenNthCalledWith(1, `${REPO_PATH}/issues/1/labels`);

      expect(fetchAPI).toHaveBeenNthCalledWith(2, `${REPO_PATH}/issues/1/labels`, {
        method: 'PUT',
        body: { labels: ['bug', 'sveltia-cms/pending_publish'] },
      });
    });
  });

  describe('updateDraftState', () => {
    test('adds and removes the WIP prefix', async () => {
      const pullRequest = /** @type {any} */ ({ number: 1, title: 'Create Post “hello”' });

      await updateDraftState(pullRequest, true);

      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/pulls/1`, {
        method: 'PATCH',
        body: { title: 'WIP: Create Post “hello”' },
      });

      await updateDraftState(pullRequest, false);

      expect(getRequestBody(1)).toEqual({ title: 'Create Post “hello”' });
    });
  });

  describe('createPullRequest', () => {
    beforeEach(() => {
      vi.mocked(fetchAPI).mockImplementation(async (path) =>
        path.endsWith('/labels')
          ? [{ name: 'sveltia-cms/draft' }, { name: 'sveltia-cms/pending_deletion' }]
          : {
              id: 900,
              number: 5,
              html_url: 'https://gitea.com/owner/repo/pulls/5',
              head: { sha: 'abc123' },
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
      );
    });

    test('opens a draft pull request and labels it', async () => {
      const result = await createPullRequest({
        branch: 'cms/posts/hello',
        title: 'Create Post “hello”',
        status: 'draft',
      });

      expect(fetchAPI).toHaveBeenNthCalledWith(1, `${REPO_PATH}/pulls`, {
        method: 'POST',
        body: {
          title: 'WIP: Create Post “hello”',
          head: 'cms/posts/hello',
          base: 'main',
          body: expect.any(String),
        },
      });

      expect(fetchAPI).toHaveBeenNthCalledWith(2, `${REPO_PATH}/issues/5/labels`, {
        method: 'POST',
        body: { labels: ['sveltia-cms/draft'] },
      });

      // The stored title excludes the WIP prefix
      expect(result).toEqual({
        number: 5,
        nodeId: '900',
        title: 'Create Post “hello”',
        url: 'https://gitea.com/owner/repo/pulls/5',
        branch: 'cms/posts/hello',
        headSHA: 'abc123',
        status: 'draft',
        createdDate: new Date('2026-01-01T00:00:00Z'),
        updatedDate: new Date('2026-01-01T00:00:00Z'),
        files: [],
      });
    });

    test('opens a removal without the WIP prefix', async () => {
      const result = await createPullRequest({
        branch: 'cms/posts/hello',
        title: 'Delete Post “hello”',
        status: 'pending_deletion',
      });

      expect(getRequestBody().title).toBe('Delete Post “hello”');
      expect(result.status).toBe('pending_deletion');
    });
  });

  describe('fetchBranchHead', () => {
    test('returns the commit the branch points at', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ commit: { id: 'abc' } });

      await expect(fetchBranchHead('cms/posts/hello')).resolves.toBe('abc');
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/branches/cms/posts/hello`);

      vi.mocked(fetchAPI).mockResolvedValue({});
      await expect(fetchBranchHead('cms/posts/hello')).resolves.toBeUndefined();
    });

    test('looks in the fork with Open Authoring', async () => {
      forkedRepository.current = { owner: 'me', repo: 'fork' };
      vi.mocked(fetchAPI).mockResolvedValue({ commit: { id: 'abc' } });

      await fetchBranchHead('cms/posts/hello');
      expect(fetchAPI).toHaveBeenCalledWith('/repos/me/fork/branches/cms/posts/hello');
    });

    test('returns undefined when the branch is gone, and rethrows anything else', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Not Found', { cause: { status: 404 } }));
      await expect(fetchBranchHead('cms/posts/hello')).resolves.toBeUndefined();

      vi.mocked(fetchAPI).mockRejectedValue(new Error('Server', { cause: { status: 500 } }));
      await expect(fetchBranchHead('cms/posts/hello')).rejects.toThrow('Server');
    });
  });

  describe('fetchPullRequestHeadRef', () => {
    test('reads the pull request’s reference on the configured repository', async () => {
      forkedRepository.current = { owner: 'me', repo: 'fork' };
      // The instance answers with a list even for an exact match, which is what a prefix filter
      // returns
      vi.mocked(fetchAPI).mockResolvedValue([{ ref: 'refs/pull/7/head', object: { sha: 'abc' } }]);

      await expect(fetchPullRequestHeadRef(7)).resolves.toBe('abc');
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/git/refs/pull/7/head`);

      // A single object is taken as well, in case an instance answers with one
      vi.mocked(fetchAPI).mockResolvedValue({ ref: 'refs/pull/7/head', object: { sha: 'def' } });
      await expect(fetchPullRequestHeadRef(7)).resolves.toBe('def');

      vi.mocked(fetchAPI).mockResolvedValue([{ ref: 'refs/pull/70/head', object: { sha: 'x' } }]);
      await expect(fetchPullRequestHeadRef(7)).resolves.toBeUndefined();
    });

    test('returns undefined when the reference is missing, and rethrows anything else', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Not Found', { cause: { status: 404 } }));
      await expect(fetchPullRequestHeadRef(7)).resolves.toBeUndefined();

      vi.mocked(fetchAPI).mockRejectedValue(new Error('Server', { cause: { status: 500 } }));
      await expect(fetchPullRequestHeadRef(7)).rejects.toThrow('Server');
    });
  });

  describe('fetchFileSHA', () => {
    test('reads another repository when asked', async () => {
      forkedRepository.current = { owner: 'me', repo: 'fork' };
      vi.mocked(fetchAPI).mockResolvedValue({ sha: 'sha1' });

      await fetchFileSHA('a.md', 'abc', { owner: 'owner', repo: 'repo' });
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/contents/a.md?ref=abc`);
    });

    test('returns the blob SHA on the given branch', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ sha: 'sha1' });

      await expect(fetchFileSHA('content/posts/hello.md', 'cms/posts/hello')).resolves.toBe('sha1');

      expect(fetchAPI).toHaveBeenCalledWith(
        `${REPO_PATH}/contents/content/posts/hello.md?ref=cms%2Fposts%2Fhello`,
      );
    });

    test('returns undefined when the file isn’t on the branch', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', { cause: { status: 404 } }),
      );

      await expect(fetchFileSHA('content/posts/hello.md', 'main')).resolves.toBeUndefined();
    });

    test('rethrows any other error', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', { cause: { status: 500 } }),
      );

      await expect(fetchFileSHA('content/posts/hello.md', 'main')).rejects.toThrow(
        'Server responded with an error',
      );
    });
  });

  describe('resolveChangeSHAs', () => {
    test('leaves the changes alone when everything is created', async () => {
      const changes = /** @type {any} */ ([{ action: 'create', path: 'a.md' }]);

      await expect(resolveChangeSHAs(changes, 'cms/posts/hello')).resolves.toBe(changes);
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    test('reads the current SHA of each existing file from the branch', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path) =>
        path.includes('hello.md') ? { sha: 'branch-sha' } : { sha: 'asset-sha' },
      );

      const changes = /** @type {any} */ ([
        { action: 'create', path: 'content/posts/new.md' },
        { action: 'update', path: 'content/posts/hello.md', previousSha: 'stale-sha' },
        { action: 'delete', path: 'static/img.png' },
      ]);

      await expect(resolveChangeSHAs(changes, 'cms/posts/hello')).resolves.toEqual([
        { action: 'create', path: 'content/posts/new.md' },
        { action: 'update', path: 'content/posts/hello.md', previousSha: 'branch-sha' },
        { action: 'delete', path: 'static/img.png', previousSha: 'asset-sha' },
      ]);
    });

    test('reads the SHA a rename moves the file from', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ sha: 'branch-sha' });

      const changes = /** @type {any} */ ([
        {
          action: 'move',
          path: 'content/posts/renamed.md',
          previousPath: 'content/posts/hello.md',
        },
      ]);

      const result = await resolveChangeSHAs(changes, 'cms/posts/hello');

      expect(fetchAPI).toHaveBeenCalledWith(
        `${REPO_PATH}/contents/content/posts/hello.md?ref=cms%2Fposts%2Fhello`,
      );

      expect(result[0].previousSha).toBe('branch-sha');
    });

    test('reshapes the changes to what a branch without the file can take', async () => {
      // A fork that has fallen behind the configured repository doesn’t have an entry added there
      // since; the update the contributor is saving is a creation as far as the fork is concerned
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Server responded with an error', { cause: { status: 404 } }),
      );

      const changes = /** @type {any} */ ([
        { action: 'update', path: 'content/posts/hello.md', previousSha: 'cached', data: 'a' },
        {
          action: 'move',
          path: 'content/posts/renamed.md',
          previousPath: 'content/posts/hello.md',
          previousSha: 'cached',
          data: 'b',
        },
        { action: 'delete', path: 'static/img.png', previousSha: 'cached' },
      ]);

      await expect(resolveChangeSHAs(changes, 'cms/me/repo/posts/hello')).resolves.toEqual([
        { action: 'create', path: 'content/posts/hello.md', data: 'a' },
        { action: 'create', path: 'content/posts/renamed.md', data: 'b' },
      ]);
    });
  });

  describe('Open Authoring', () => {
    beforeEach(() => {
      forkedRepository.current = { owner: 'me', repo: 'repo' };
    });

    test('reads a changed file from the fork', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        sha: 'sha1',
        size: 1,
        content: 'YQ==',
        encoding: 'base64',
      });

      const file = /** @type {any} */ ({ path: 'content/posts/hello.md' });

      await fetchPullRequestFileContent(
        /** @type {any} */ ({ branch: 'cms/me/repo/posts/hello' }),
        file,
      );

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/me/repo/contents/content/posts/hello.md?ref=cms%2Fme%2Frepo%2Fposts%2Fhello',
      );
      expect(file.text).toBe('a');
    });

    test('resolves the SHA of a file on the fork', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ sha: 'fork-sha' });

      await expect(fetchFileSHA('content/posts/hello.md', 'cms/me/repo/posts/hello')).resolves.toBe(
        'fork-sha',
      );
      expect(fetchAPI).toHaveBeenCalledWith(expect.stringMatching(/^\/repos\/me\/repo\//));
    });

    test('deletes the branch from the fork', async () => {
      await deleteBranch('cms/me/repo/posts/hello');

      expect(fetchAPI).toHaveBeenCalledWith('/repos/me/repo/branches/cms/me/repo/posts/hello', {
        method: 'DELETE',
        responseType: 'text',
      });
    });

    test('opens a cross-repository pull request without a label', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        id: 900,
        number: 5,
        html_url: 'https://gitea.com/owner/repo/pulls/5',
        head: { sha: 'abc123' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      const result = await createPullRequest({
        branch: 'cms/me/repo/posts/hello',
        title: 'Create Post “hello”',
        status: 'pending_review',
      });

      // The pull request is opened on the configured repository, from the fork’s branch
      expect(fetchAPI).toHaveBeenCalledTimes(1);
      expect(fetchAPI).toHaveBeenCalledWith(`${REPO_PATH}/pulls`, {
        method: 'POST',
        body: {
          title: 'Create Post “hello”',
          head: 'me:cms/me/repo/posts/hello',
          base: 'main',
          body: expect.any(String),
        },
      });

      // Labelling needs write access, which a contributor doesn’t have
      expect(fetchAPI).not.toHaveBeenCalledWith(
        expect.stringContaining('/labels'),
        expect.anything(),
      );
      expect(result.status).toBe('pending_review');
    });
  });
});
