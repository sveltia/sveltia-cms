import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchLastCommit } from '$lib/services/backends/git/github/commits';
import {
  fetchBlob,
  fetchBlobText,
  fetchFileContents,
  fetchFileList,
  fetchFileMetadata,
  fetchFiles,
  getFileContentsQuery,
  getFileMetadataQuery,
  parseFileContents,
  parseFileMetadata,
} from '$lib/services/backends/git/github/files';
import {
  getWorkflowRepository,
  initOpenAuthoring,
  isOpenAuthoringConfigured,
} from '$lib/services/backends/git/github/fork';
import {
  checkRepositoryAccess,
  fetchDefaultBranchName,
  repository,
} from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { MAX_CONCURRENT_REQUESTS } from '$lib/services/backends/git/shared/concurrency';
import { fetchAndParseFiles } from '$lib/services/backends/git/shared/fetch';
import { startSimulatedProgress } from '$lib/services/backends/git/shared/progress';

// Mock dependencies
vi.mock('$lib/services/backends/git/github/commits');
vi.mock('$lib/services/backends/git/github/fork');
vi.mock('$lib/services/backends/git/github/repository');
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/backends/git/shared/fetch');

// The function returned by `startSimulatedProgress()`, so the tests can verify it’s called
const stopProgress = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/backends/git/shared/progress', () => ({
  startSimulatedProgress: vi.fn(() => stopProgress),
}));
vi.mock('mime', () => ({ default: { getType: vi.fn() } }));

describe('GitHub files service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(repository, {
      owner: 'test-owner',
      repo: 'test-repo',
      branch: 'main',
    });
    vi.mocked(isOpenAuthoringConfigured).mockReturnValue(false);
    vi.mocked(getWorkflowRepository).mockReturnValue({ owner: 'test-owner', repo: 'test-repo' });
  });

  describe('fetchFileList', () => {
    test('fetches file list successfully', async () => {
      const mockTree = {
        tree: [
          { type: 'blob', path: 'file1.txt', sha: 'sha1', size: 100 },
          { type: 'blob', path: 'folder/file2.md', sha: 'sha2', size: 200 },
          { type: 'tree', path: 'folder', sha: 'sha3', size: 0 }, // Should be filtered out
        ],
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockTree);

      const result = await fetchFileList();

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/git/trees/main?recursive=1',
      );
      expect(result).toEqual([
        { path: 'file1.txt', sha: 'sha1', size: 100, name: 'file1.txt' },
        { path: 'folder/file2.md', sha: 'sha2', size: 200, name: 'file2.md' },
      ]);
    });

    test('fetches file list with custom hash', async () => {
      const mockTree = { tree: [] };
      const customHash = 'custom-hash';

      vi.mocked(fetchAPI).mockResolvedValue(mockTree);

      await fetchFileList(customHash);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/repos/test-owner/test-repo/git/trees/${customHash}?recursive=1`,
      );
    });
  });

  describe('getFileContentsQuery', () => {
    test('generates GraphQL query for file contents', () => {
      const chunk = /** @type {any[]} */ ([
        { type: 'entry', path: 'file1.txt', sha: 'sha1' },
        { type: 'entry', path: 'file2.md', sha: 'sha2' },
      ]);

      const result = getFileContentsQuery(chunk, 0);

      expect(result).toContain('query($owner: String!, $repo: String!)');
      expect(result).toContain('repository');
      expect(result).toContain('content_0: object(oid: "sha1")');
      expect(result).toContain('content_1: object(oid: "sha2")');
      // The truncation flag is needed to detect an oversized blob
      expect(result).toContain('... on Blob { text isTruncated }');
      // The commit history is fetched separately, as it’s the slow part
      expect(result).not.toContain('history(');
    });

    test('generates query with start index offset', () => {
      const chunk = /** @type {any[]} */ ([{ type: 'entry', path: 'file.txt', sha: 'sha1' }]);
      const result = getFileContentsQuery(chunk, 10);

      expect(result).toContain('content_10:');
    });

    test('skips content query for asset types while keeping the indices', () => {
      const chunk = /** @type {any[]} */ ([
        { type: 'asset', path: 'image.png', sha: 'sha1' },
        { type: 'asset', path: 'video.mp4', sha: 'sha2' },
        { type: 'entry', path: 'doc.md', sha: 'sha3' },
      ]);

      const result = getFileContentsQuery(chunk, 5);

      expect(result).not.toContain('content_5:');
      expect(result).not.toContain('content_6:');
      expect(result).toContain('content_7:');
    });
  });

  describe('getFileMetadataQuery', () => {
    test('generates GraphQL query for the last commit of every file', () => {
      const chunk = /** @type {any[]} */ ([
        { type: 'asset', path: 'image.png', sha: 'sha1' },
        { type: 'entry', path: 'doc.md', sha: 'sha2' },
      ]);

      const result = getFileMetadataQuery(chunk, 5);

      expect(result).toContain('query($owner: String!, $repo: String!, $branch: String!)');
      expect(result).toContain('commit_5: ref(qualifiedName: $branch)');
      expect(result).toContain('history(first: 1, path: "image.png")');
      expect(result).toContain('commit_6: ref(qualifiedName: $branch)');
      expect(result).toContain('history(first: 1, path: "doc.md")');
      expect(result).not.toContain('content_');
    });
  });

  describe('fetchBlobText', () => {
    test('retrieves the blob content with the REST API', async () => {
      vi.mocked(fetchAPI).mockResolvedValue('Full content');

      const result = await fetchBlobText({ owner: 'test-owner', repo: 'test-repo', sha: 'sha1' });

      expect(fetchAPI).toHaveBeenCalledWith('/repos/test-owner/test-repo/git/blobs/sha1', {
        headers: { Accept: 'application/vnd.github.raw' },
        responseType: 'text',
      });
      expect(result).toBe('Full content');
    });
  });

  describe('parseFileContents', () => {
    test('parses file contents, leaving the metadata for the second pass', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.txt', sha: 'sha1', size: 100, name: 'file1.txt' },
        { path: 'file2.md', sha: 'sha2', size: 200, name: 'file2.md' },
      ]);

      const results = {
        content_0: { text: 'Content of file1' },
        content_1: { text: 'Content of file2' },
      };

      const result = await parseFileContents(fetchingFiles, results);

      expect(result).toEqual({
        'file1.txt': { sha: 'sha1', size: 100, text: 'Content of file1', meta: undefined },
        'file2.md': { sha: 'sha2', size: 200, text: 'Content of file2', meta: undefined },
      });
    });

    test('handles missing text content', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'image.png', sha: 'sha1', size: 100, name: 'image.png' },
      ]);

      const result = await parseFileContents(fetchingFiles, {});

      expect(result['image.png']).toEqual({
        sha: 'sha1',
        size: 100,
        text: undefined,
        meta: undefined,
      });
    });

    test('re-fetches a truncated blob with the REST API', async () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'large.md', sha: 'sha1', size: 543840 },
        { path: 'small.md', sha: 'sha2', size: 100 },
      ]);

      const results = {
        content_0: { text: 'Cut short at 512 KB', isTruncated: true },
        content_1: { text: 'Content of small.md', isTruncated: false },
      };

      vi.mocked(fetchAPI).mockResolvedValue('Complete content of large.md');

      const result = await parseFileContents(fetchingFiles, results);

      // Only the truncated blob is fetched again
      expect(fetchAPI).toHaveBeenCalledOnce();
      expect(fetchAPI).toHaveBeenCalledWith('/repos/test-owner/test-repo/git/blobs/sha1', {
        headers: { Accept: 'application/vnd.github.raw' },
        responseType: 'text',
      });
      expect(result['large.md'].text).toBe('Complete content of large.md');
      expect(result['small.md'].text).toBe('Content of small.md');
    });
  });

  describe('parseFileMetadata', () => {
    /**
     * Create a commit history node as returned by the GraphQL API.
     * @param {string} name Author name.
     * @param {any} user GitHub user of the author, or `null` for an unlinked author.
     * @param {string} date Commit date.
     * @returns {any} Node.
     */
    const createCommit = (name, user, date) => ({
      target: {
        history: {
          nodes: [{ author: { name, email: `${name}@example.com`, user }, committedDate: date }],
        },
      },
    });

    test('parses the last commit of every file', () => {
      const fetchingFiles = /** @type {any[]} */ ([
        { path: 'file1.txt', sha: 'sha1', size: 100 },
        { path: 'image.png', sha: 'sha2', size: 200 },
      ]);

      const results = {
        commit_0: createCommit(
          'Author 1',
          { id: 'user1', login: 'author1' },
          '2023-01-01T00:00:00Z',
        ),
        // A commit whose author isn’t linked to a GitHub account
        commit_1: createCommit('Author 2', null, '2023-01-02T00:00:00Z'),
      };

      expect(parseFileMetadata(fetchingFiles, results)).toEqual({
        'file1.txt': {
          commitAuthor: {
            name: 'Author 1',
            email: 'Author 1@example.com',
            id: 'user1',
            login: 'author1',
          },
          commitDate: new Date('2023-01-01T00:00:00Z'),
        },
        'image.png': {
          commitAuthor: {
            name: 'Author 2',
            email: 'Author 2@example.com',
            id: undefined,
            login: undefined,
          },
          commitDate: new Date('2023-01-02T00:00:00Z'),
        },
      });
    });
  });

  describe('fetchFileContents', () => {
    /**
     * Build a GraphQL response holding the text of the given files.
     * @param {any[]} files Files.
     * @returns {any} Response.
     */
    const createResponse = (files) => ({
      repository: Object.fromEntries(
        files.map(({ path }, i) => [`content_${i}`, { text: `Content of ${path}` }]),
      ),
    });

    test('fetches and parses file contents', async () => {
      const fetchingFiles = /** @type {any[]} */ ([{ path: 'file.txt', sha: 'sha1', size: 100 }]);

      vi.mocked(fetchGraphQL).mockResolvedValue(createResponse(fetchingFiles));

      const result = await fetchFileContents(fetchingFiles);

      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('content_0: object'));
      expect(startSimulatedProgress).toHaveBeenCalledWith(fetchingFiles.length);
      expect(stopProgress).toHaveBeenCalledOnce();
      expect(result['file.txt']).toEqual({
        sha: 'sha1',
        size: 100,
        text: 'Content of file.txt',
        meta: undefined,
      });
    });

    test('splits a large file list into chunks', async () => {
      const fetchingFiles = /** @type {any[]} */ (
        Array.from({ length: 300 }, (_, i) => ({ path: `file${i}.txt`, sha: `sha${i}`, size: 100 }))
      );

      vi.mocked(fetchGraphQL).mockImplementation(async (query) => {
        // Answer only the aliases the query asks for, as the API does
        const aliases = [.../** @type {string} */ (query).matchAll(/content_(\d+):/g)].map(
          ([, i]) => Number(i),
        );

        return {
          repository: Object.fromEntries(
            aliases.map((i) => [`content_${i}`, { text: `Content of ${fetchingFiles[i].path}` }]),
          ),
        };
      });

      const result = await fetchFileContents(fetchingFiles);

      // 300 files / 250 per chunk = 2 requests
      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(Object.keys(result)).toHaveLength(300);
      expect(result['file299.txt'].text).toBe('Content of file299.txt');
    });

    test('makes exactly one request for a chunk-sized list', async () => {
      const fetchingFiles = /** @type {any[]} */ (
        Array.from({ length: 250 }, (_, i) => ({ path: `file${i}.txt`, sha: `sha${i}`, size: 100 }))
      );

      vi.mocked(fetchGraphQL).mockResolvedValue(createResponse(fetchingFiles));

      await fetchFileContents(fetchingFiles);

      expect(fetchGraphQL).toHaveBeenCalledTimes(1);
    });

    test('keeps only a few queries in flight, without a fixed delay between them', async () => {
      const fetchingFiles = /** @type {any[]} */ (
        Array.from({ length: 3000 }, (_, i) => ({
          path: `file${i}.txt`,
          sha: `sha${i}`,
          size: 100,
        }))
      );

      /** @type {(() => void)[]} */
      const resolvers = [];
      let inFlight = 0;
      let peak = 0;

      vi.mocked(fetchGraphQL).mockImplementation(
        (query) =>
          new Promise((resolve) => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);

            resolvers.push(() => {
              inFlight -= 1;

              const aliases = [.../** @type {string} */ (query).matchAll(/content_(\d+):/g)].map(
                ([, i]) => Number(i),
              );

              resolve({
                repository: Object.fromEntries(
                  aliases.map((i) => [`content_${i}`, { text: `Content of file${i}.txt` }]),
                ),
              });
            });
          }),
      );

      const promise = fetchFileContents(fetchingFiles);

      // 3000 files / 250 per chunk = 12 queries, but no more than the general limit at once
      await vi.waitFor(() => {
        expect(fetchGraphQL).toHaveBeenCalledTimes(MAX_CONCURRENT_REQUESTS);
      });

      // Release the pending queries one by one; a worker picks up the next chunk each time
      while (resolvers.length) {
        /** @type {any} */ (resolvers.shift())();
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      }

      const result = await promise;

      expect(fetchGraphQL).toHaveBeenCalledTimes(12);
      expect(peak).toBe(MAX_CONCURRENT_REQUESTS);
      expect(Object.keys(result)).toHaveLength(3000);
    });

    test('handles empty file list', async () => {
      const result = await fetchFileContents([]);

      expect(result).toEqual({});
      expect(fetchGraphQL).not.toHaveBeenCalled();
      expect(startSimulatedProgress).toHaveBeenCalledWith(0);
      expect(stopProgress).toHaveBeenCalledOnce();
    });

    test('stops the simulated progress when a request fails', async () => {
      const fetchingFiles = /** @type {any[]} */ ([{ path: 'file.txt', sha: 'sha1', size: 100 }]);

      vi.mocked(fetchGraphQL).mockRejectedValue(new Error('Unauthorized'));

      await expect(fetchFileContents(fetchingFiles)).rejects.toThrow('Unauthorized');
      // Otherwise the interval would keep running behind the error message
      expect(stopProgress).toHaveBeenCalledOnce();
    });
  });

  describe('fetchFileMetadata', () => {
    test('fetches the last commit of every file in chunks', async () => {
      const fetchingFiles = /** @type {any[]} */ (
        Array.from({ length: 300 }, (_, i) => ({ path: `file${i}.txt`, sha: `sha${i}`, size: 100 }))
      );

      vi.mocked(fetchGraphQL).mockImplementation(async (query) => {
        const aliases = [.../** @type {string} */ (query).matchAll(/commit_(\d+):/g)].map(([, i]) =>
          Number(i),
        );

        return {
          repository: Object.fromEntries(
            aliases.map((i) => [
              `commit_${i}`,
              {
                target: {
                  history: {
                    nodes: [
                      {
                        author: { name: `Author ${i}`, email: 'a@example.com', user: null },
                        committedDate: '2023-01-01T00:00:00Z',
                      },
                    ],
                  },
                },
              },
            ]),
          ),
        };
      });

      const result = await fetchFileMetadata(fetchingFiles);

      expect(fetchGraphQL).toHaveBeenCalledTimes(2);
      expect(fetchGraphQL).toHaveBeenCalledWith(expect.stringContaining('history(first: 1'));
      // No progress bar: this runs in the background once the contents are shown
      expect(startSimulatedProgress).not.toHaveBeenCalled();
      expect(Object.keys(result)).toHaveLength(300);
      expect(result['file299.txt'].commitAuthor?.name).toBe('Author 299');
      expect(result['file299.txt'].commitDate).toEqual(new Date('2023-01-01T00:00:00Z'));
    });
  });

  describe('fetchFiles', () => {
    test('fetches files through shared fetch function', async () => {
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      expect(initOpenAuthoring).not.toHaveBeenCalled();
      // The access check is handed over so it can run alongside the branch and commit requests
      expect(fetchAndParseFiles).toHaveBeenCalledWith({
        repository,
        checkAccess: checkRepositoryAccess,
        fetchDefaultBranchName,
        fetchLastCommit,
        fetchFileList,
        fetchFileContents,
        fetchFileMetadata,
      });
    });

    test('sets up the contributor’s fork when Open Authoring is configured', async () => {
      vi.mocked(isOpenAuthoringConfigured).mockReturnValue(true);
      vi.mocked(initOpenAuthoring).mockResolvedValue();
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      expect(initOpenAuthoring).toHaveBeenCalled();
      // A contributor without write access is expected here, so the plain access check is skipped
      expect(checkRepositoryAccess).not.toHaveBeenCalled();
      expect(fetchAndParseFiles).toHaveBeenCalledWith(
        expect.objectContaining({ checkAccess: undefined }),
      );
    });
  });

  describe('fetchBlob', () => {
    test('fetches blob as binary content', async () => {
      const asset = /** @type {any} */ ({
        sha: 'test-sha',
        path: 'image.jpg',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'application/octet-stream']]),
        blob: vi.fn().mockResolvedValue(new Blob(['binary data'])),
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await fetchBlob(asset);

      expect(fetchAPI).toHaveBeenCalledWith('/repos/test-owner/test-repo/git/blobs/test-sha', {
        headers: { Accept: 'application/vnd.github.raw' },
        responseType: 'raw',
      });
      expect(mockResponse.blob).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Blob);
    });

    test('reads an unpublished asset from the workflow repository', async () => {
      vi.mocked(getWorkflowRepository).mockReturnValue({ owner: 'contributor', repo: 'test-repo' });

      const asset = /** @type {any} */ ({
        sha: 'test-sha',
        path: 'image.jpg',
        workflow: { branch: 'cms/contributor/test-repo/posts/hello' },
      });

      vi.mocked(fetchAPI).mockResolvedValue({
        headers: new Map([['Content-Type', 'application/octet-stream']]),
        blob: vi.fn().mockResolvedValue(new Blob(['binary data'])),
      });

      await fetchBlob(asset);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/contributor/test-repo/git/blobs/test-sha',
        expect.any(Object),
      );
    });

    test('handles text content with correct MIME type', async () => {
      const asset = /** @type {any} */ ({
        sha: 'test-sha',
        path: 'file.svg',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'image/svg+xml']]),
        text: vi.fn().mockResolvedValue('<svg></svg>'),
      };

      const mockMime = await import('mime');

      vi.mocked(mockMime.default.getType).mockReturnValue('image/svg+xml');

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await fetchBlob(asset);

      expect(mockResponse.text).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('image/svg+xml');
    });

    test('falls back to text/plain for unknown MIME types', async () => {
      const asset = /** @type {any} */ ({
        sha: 'test-sha',
        path: 'file.unknown',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'text/plain']]),
        text: vi.fn().mockResolvedValue('text content'),
      };

      const mockMime = await import('mime');

      vi.mocked(mockMime.default.getType).mockReturnValue(null);

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await fetchBlob(asset);

      expect(result.type).toBe('text/plain');
    });

    test('handles text files with JSON content', async () => {
      const asset = /** @type {any} */ ({
        sha: 'json-sha',
        path: 'data.json',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'application/json']]),
        text: vi.fn().mockResolvedValue('{"key":"value"}'),
      };

      const mockMime = await import('mime');

      vi.mocked(mockMime.default.getType).mockReturnValue('application/json');

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await fetchBlob(asset);

      expect(result.type).toBe('application/json');
    });

    test('handles text files with Markdown content', async () => {
      const asset = /** @type {any} */ ({
        sha: 'md-sha',
        path: 'README.md',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'text/markdown']]),
        text: vi.fn().mockResolvedValue('# Readme'),
      };

      const mockMime = await import('mime');

      vi.mocked(mockMime.default.getType).mockReturnValue('text/markdown');

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await fetchBlob(asset);

      expect(result.type).toBe('text/markdown');
    });

    test('calls fetchAPI with correct repository and asset SHA', async () => {
      const asset = /** @type {any} */ ({
        sha: 'custom-sha-123',
        path: 'path/to/file.bin',
      });

      const mockResponse = {
        headers: new Map([['Content-Type', 'application/octet-stream']]),
        blob: vi.fn().mockResolvedValue(new Blob()),
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      await fetchBlob(asset);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/git/blobs/custom-sha-123',
        expect.objectContaining({
          headers: { Accept: 'application/vnd.github.raw' },
          responseType: 'raw',
        }),
      );
    });
  });
});
