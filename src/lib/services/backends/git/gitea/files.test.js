// @vitest-environment happy-dom

import { decodeBase64, getPathInfo } from '@sveltia/utils/file';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchLastCommit } from '$lib/services/backends/git/gitea/commits';
import {
  getWorkflowRepository,
  initOpenAuthoring,
  isOpenAuthoringConfigured,
} from '$lib/services/backends/git/gitea/fork';
import { checkInstanceVersion, instance } from '$lib/services/backends/git/gitea/instance';
import {
  checkBranchAccess,
  checkRepositoryAccess,
  fetchDefaultBranchName,
  repository,
} from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { fetchAndParseFiles } from '$lib/services/backends/git/shared/fetch';
import { dataLoadedProgress } from '$lib/services/contents';
import { forkedRepository, openAuthoringInitialized } from '$lib/services/workflow/open-authoring';

import {
  createBatches,
  fetchBlob,
  fetchFileContents,
  fetchFileList,
  fetchFiles,
  fetchRawFile,
  parseFileContents,
} from './files.js';

/**
 * @import { Asset, BaseFileListItem } from '$lib/types/private';
 */

// Mock dependencies
vi.mock('@sveltia/utils/file', () => ({
  decodeBase64: vi.fn(),
  getPathInfo: vi.fn(),
}));

vi.mock('$lib/services/backends/git/gitea/commits', () => ({
  fetchLastCommit: vi.fn(),
}));

vi.mock('$lib/services/backends/git/gitea/fork', () => ({
  getWorkflowRepository: vi.fn(() => ({ owner: 'test-owner', repo: 'test-repo' })),
  initOpenAuthoring: vi.fn(),
  isOpenAuthoringConfigured: vi.fn(() => false),
}));

vi.mock('$lib/services/backends/git/gitea/instance', () => ({
  checkInstanceVersion: vi.fn(),
  instance: { isForgejo: false },
}));

vi.mock('$lib/services/backends/git/gitea/repository', () => ({
  repository: {
    owner: 'test-owner',
    repo: 'test-repo',
    branch: 'main',
  },
  checkBranchAccess: vi.fn(),
  checkRepositoryAccess: vi.fn(),
  fetchDefaultBranchName: vi.fn(),
}));

vi.mock('$lib/services/backends/git/shared/api', () => ({
  fetchAPI: vi.fn(),
}));

vi.mock('$lib/services/backends/git/shared/fetch', () => ({
  fetchAndParseFiles: vi.fn(),
}));

// Record every value set on the progress state, so the tests can verify the sequence
const progressValues = vi.hoisted(() => /** @type {(number | undefined)[]} */ ([]));

vi.mock('$lib/services/contents', () => ({
  dataLoadedProgress: {
    /**
     * Get the last value.
     * @returns {number | undefined} Value.
     */
    get current() {
      return progressValues.at(-1);
    },
    /**
     * Record a new value.
     * @param {number | undefined} value Value.
     */
    set current(value) {
      progressValues.push(value);
    },
  },
}));

describe('Gitea Files Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    progressValues.length = 0;
    // Reset instance to default state
    vi.mocked(instance).isForgejo = false;
    // A maintainer works on the configured repository unless a test says otherwise
    vi.mocked(getWorkflowRepository).mockReturnValue({ owner: 'test-owner', repo: 'test-repo' });
    vi.mocked(isOpenAuthoringConfigured).mockReturnValue(false);
    forkedRepository.current = undefined;
    openAuthoringInitialized.current = false;
  });

  describe('fetchFileList', () => {
    test('should fetch file list without pagination', async () => {
      const mockTree = [
        { type: 'blob', path: 'file1.md', sha: 'abc123', size: 100 },
        { type: 'blob', path: 'file2.txt', sha: 'def456', size: 200 },
        { type: 'tree', path: 'folder', sha: 'ghi789', size: 0 }, // should be filtered out
      ];

      vi.mocked(fetchAPI).mockResolvedValue({
        tree: mockTree,
        truncated: false,
      });

      vi.mocked(getPathInfo).mockImplementation((path) => ({
        basename: path.split('/').pop() || '',
        filename: path.split('/').pop() || '',
      }));

      const result = await fetchFileList();

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/git/trees/main?recursive=1&page=1',
      );
      expect(result).toEqual([
        { path: 'file1.md', sha: 'abc123', size: 100, name: 'file1.md' },
        { path: 'file2.txt', sha: 'def456', size: 200, name: 'file2.txt' },
      ]);
    });

    test('should fetch file list with pagination', async () => {
      const mockTree1 = [{ type: 'blob', path: 'file1.md', sha: 'abc123', size: 100 }];
      const mockTree2 = [{ type: 'blob', path: 'file2.txt', sha: 'def456', size: 200 }];

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({
          tree: mockTree1,
          truncated: true,
        })
        .mockResolvedValueOnce({
          tree: mockTree2,
          truncated: false,
        });

      vi.mocked(getPathInfo).mockImplementation((path) => ({
        basename: path.split('/').pop() || '',
        filename: path.split('/').pop() || '',
      }));

      const result = await fetchFileList('commit-hash');

      expect(fetchAPI).toHaveBeenNthCalledWith(
        1,
        '/repos/test-owner/test-repo/git/trees/commit-hash?recursive=1&page=1',
      );
      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        '/repos/test-owner/test-repo/git/trees/commit-hash?recursive=1&page=2',
      );
      expect(result).toHaveLength(2);
    });

    test('should handle empty tree response', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        tree: null,
        truncated: false,
      });

      const result = await fetchFileList();

      expect(result).toEqual([]);
    });

    test('should filter out non-blob entries', async () => {
      const mockTree = [
        { type: 'blob', path: 'file1.md', sha: 'abc123', size: 100 },
        { type: 'tree', path: 'folder', sha: 'ghi789', size: 0 },
        { type: 'commit', path: 'submodule', sha: 'jkl012', size: 0 },
      ];

      vi.mocked(fetchAPI).mockResolvedValue({
        tree: mockTree,
        truncated: false,
      });

      vi.mocked(getPathInfo).mockImplementation((path) => ({
        basename: path.split('/').pop() || '',
        filename: path.split('/').pop() || '',
      }));

      const result = await fetchFileList();

      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('file1.md');
    });
  });

  describe('parseFileContents', () => {
    test('should parse file contents from API response', async () => {
      // @ts-ignore - Type compatibility in test
      const fetchingFiles = [
        { path: 'file1.md', sha: 'abc123', size: 100, type: 'entry', name: 'file1.md' },
        { path: 'file2.txt', sha: 'def456', size: 200, type: 'entry', name: 'file2.txt' },
      ];

      const results = {
        'file1.md': { content: 'SGVsbG8gd29ybGQ=', encoding: 'base64' },
        'file2.txt': { content: 'VGVzdCBjb250ZW50', encoding: 'base64' },
      };

      vi.mocked(decodeBase64)
        .mockResolvedValueOnce('Hello world')
        .mockResolvedValueOnce('Test content');

      // @ts-ignore - Type compatibility in test
      const result = await parseFileContents(fetchingFiles, results);

      expect(result).toEqual({
        'file1.md': {
          sha: 'abc123',
          size: 100,
          text: 'Hello world',
          meta: {},
        },
        'file2.txt': {
          sha: 'def456',
          size: 200,
          text: 'Test content',
          meta: {},
        },
      });
    });

    test('should handle files without content', async () => {
      // @ts-ignore - Type compatibility in test
      const fetchingFiles = [
        { path: 'file1.md', sha: 'abc123', size: undefined, type: 'entry', name: 'file1.md' },
      ];

      const results = { 'file1.md': null };
      // @ts-ignore - Type compatibility in test
      const result = await parseFileContents(fetchingFiles, results);

      // Neither text nor metadata, so the file isn’t cached as fetched and is requested again
      expect(result).toEqual({
        'file1.md': {
          sha: 'abc123',
          size: 0,
          text: undefined,
          meta: undefined,
        },
      });
    });

    test('should keep the empty content of an empty file', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'file1.md', sha: 'abc123', size: 0, type: 'entry', name: 'file1.md' },
      ];

      const result = await parseFileContents(fetchingFiles, {
        'file1.md': { path: 'file1.md', content: '', encoding: 'base64' },
      });

      expect(result).toEqual({ 'file1.md': { sha: 'abc123', size: 0, text: '', meta: {} } });
    });

    test('should handle files with non-base64 encoding', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'file1.md', sha: 'abc123', size: 100, type: 'entry', name: 'file1.md' },
      ];

      const results = { 'file1.md': { content: 'plain text', encoding: null } };
      const result = await parseFileContents(fetchingFiles, results);

      expect(result).toEqual({
        'file1.md': {
          sha: 'abc123',
          size: 100,
          text: '',
          meta: {},
        },
      });
    });

    test('should handle files with undefined size (uses fallback of 0)', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Intentionally testing undefined size
        { path: 'file1.md', sha: 'abc123', size: undefined, type: 'entry', name: 'file1.md' },
      ];

      const results = /** @type {Record<string, import('./files.js').PartialContentsListItem>} */ ({
        'file1.md': { content: 'SGVsbG8=', encoding: 'base64' },
      });

      vi.mocked(decodeBase64).mockResolvedValueOnce('Hello');

      const result = await parseFileContents(fetchingFiles, results);

      expect(result).toEqual({
        'file1.md': {
          sha: 'abc123',
          size: 0, // Should default to 0 when size is undefined
          text: 'Hello',
          meta: {},
        },
      });
    });

    test('should leave a file that the API didn’t return to be fetched again', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'file1.md', sha: 'abc123', size: 100, type: 'entry', name: 'file1.md' },
      ];

      const result = await parseFileContents(fetchingFiles, {});

      // An empty text with metadata would be cached as the file’s content for good, and the entry
      // would lose its content the next time it’s saved
      expect(result).toEqual({
        'file1.md': { sha: 'abc123', size: 100, text: undefined, meta: undefined },
      });
    });

    test('should mark an asset, whose content is never requested, as fetched', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'img.png', sha: 'abc123', size: 100, type: 'asset', name: 'img.png' },
      ];

      const result = await parseFileContents(fetchingFiles, {});

      expect(result).toEqual({ 'img.png': { sha: 'abc123', size: 100, text: '', meta: {} } });
    });
  });

  describe('createBatches', () => {
    test('should return no batch for an empty list', () => {
      expect(createBatches([], { maxItems: 10, maxResponseSize: Infinity })).toEqual([]);
    });

    test('should treat a file of unknown size as empty', () => {
      // Intentionally testing undefined size
      const files = /** @type {any[]} */ ([{ path: 'a.md' }, { path: 'b.md' }]);

      expect(createBatches(files, { maxItems: 10, maxResponseSize: 100 })).toEqual([files]);
    });

    test('should give a file that exceeds the response size on its own a batch of its own', () => {
      const files = /** @type {any[]} */ ([
        { path: 'a.md', size: 10 },
        { path: 'huge.md', size: 10_000 },
        { path: 'b.md', size: 10 },
      ]);

      // A batch is never left empty, so the oversized file doesn’t stall the loop
      expect(createBatches(files, { maxItems: 10, maxResponseSize: 100 })).toEqual([
        [files[0]],
        [files[1]],
        [files[2]],
      ]);
    });
  });

  describe('fetchFileContents', () => {
    test('should fetch file contents for Gitea (non-Forgejo)', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'file1.md', sha: 'abc123', size: 100, type: 'entry', name: 'file1.md' },
        // @ts-ignore - Type compatibility in test
        { path: 'file2.txt', sha: 'def456', size: 200, type: 'entry', name: 'file2.txt' },
      ];

      const mockResults = [
        { path: 'file1.md', content: 'SGVsbG8gd29ybGQ=', encoding: 'base64' },
        { path: 'file2.txt', content: 'VGVzdCBjb250ZW50', encoding: 'base64' },
      ];

      // Mock API settings response
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ default_paging_num: 30 })
        .mockResolvedValueOnce(mockResults);

      vi.mocked(decodeBase64)
        .mockResolvedValueOnce('Hello world')
        .mockResolvedValueOnce('Test content');

      await fetchFileContents(fetchingFiles);

      expect(fetchAPI).toHaveBeenNthCalledWith(1, '/settings/api');
      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        '/repos/test-owner/test-repo/file-contents?ref=main',
        {
          method: 'POST',
          body: { files: ['file1.md', 'file2.txt'] },
        },
      );
      expect(progressValues).toEqual([0, 100, undefined]);
      expect(dataLoadedProgress.current).toBeUndefined();
    });

    test('should fetch file contents for Forgejo', async () => {
      // Mock Forgejo instance
      vi.mocked(instance).isForgejo = true;

      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'file1.md', sha: 'abc123', size: 100, type: 'entry', name: 'file1.md' },
      ];

      const mockResults = [{ sha: 'abc123', content: 'SGVsbG8gd29ybGQ=', encoding: 'base64' }];

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ default_paging_num: 30 })
        .mockResolvedValueOnce(mockResults);

      vi.mocked(decodeBase64).mockResolvedValueOnce('Hello world');

      await fetchFileContents(fetchingFiles);

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        '/repos/test-owner/test-repo/git/blobs?shas=abc123',
      );
    });

    test('should handle pagination when fetching file contents', async () => {
      /** @type {BaseFileListItem[]} */
      // @ts-ignore - Type compatibility in test
      const fetchingFiles = Array.from({ length: 35 }, (_, i) => ({
        path: `file${i}.md`,
        sha: `sha${i}`,
        size: 100,
        type: 'entry',
        name: `file${i}.md`,
      }));

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ default_paging_num: 30 })
        .mockResolvedValueOnce(
          Array.from({ length: 30 }, (_, i) => ({
            path: `file${i}.md`,
            content: 'dGVzdA==',
            encoding: 'base64',
          })),
        )
        .mockResolvedValueOnce(
          Array.from({ length: 5 }, (_, i) => ({
            path: `file${i + 30}.md`,
            content: 'dGVzdA==',
            encoding: 'base64',
          })),
        );

      vi.mocked(decodeBase64).mockResolvedValue('test');

      const result = await fetchFileContents(fetchingFiles);

      expect(fetchAPI).toHaveBeenCalledTimes(3); // 1 for settings + 2 for batches
      expect(Object.keys(result)).toHaveLength(35);
    });

    test('should filter out asset files', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'file1.md', sha: 'abc123', size: 100, type: 'entry', name: 'file1.md' },
        // @ts-ignore - Type compatibility in test
        { path: 'image.jpg', sha: 'def456', size: 200, type: 'asset', name: 'image.jpg' },
      ];

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ default_paging_num: 30 })
        .mockResolvedValueOnce([{ path: 'file1.md', content: 'dGVzdA==', encoding: 'base64' }]);

      vi.mocked(decodeBase64).mockResolvedValue('test');

      await fetchFileContents(fetchingFiles);

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        '/repos/test-owner/test-repo/file-contents?ref=main',
        {
          method: 'POST',
          body: { files: ['file1.md'] }, // only entry files
        },
      );
    });

    test('should match the results to the files by identifier, not by position', async () => {
      // An asset sits between the entry and the config file, but the request skips it, so a result
      // can’t be matched to a file by its position in the list
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'content/a.md', sha: 'sha1', size: 10, type: 'entry', name: 'a.md' },
        // @ts-ignore - Type compatibility in test
        { path: 'static/img.png', sha: 'sha2', size: 20, type: 'asset', name: 'img.png' },
        // @ts-ignore - Type compatibility in test
        { path: '.gitattributes', sha: 'sha3', size: 30, type: 'config', name: '.gitattributes' },
      ];

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ default_paging_num: 30 })
        .mockResolvedValueOnce([
          { path: 'content/a.md', content: 'QQ==', encoding: 'base64' },
          { path: '.gitattributes', content: 'Qg==', encoding: 'base64' },
        ]);

      vi.mocked(decodeBase64).mockImplementation(async (content) =>
        content === 'QQ==' ? 'entry text' : 'config text',
      );

      const result = await fetchFileContents(fetchingFiles);

      expect(result['content/a.md'].text).toBe('entry text');
      expect(result['.gitattributes'].text).toBe('config text');
      // The asset’s content was never requested, so it gets none
      expect(result['static/img.png'].text).toBe('');
    });

    test('should read an oversized blob from the raw endpoint', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'content/small.md', sha: 'sha1', size: 100, type: 'entry', name: 'small.md' },
        // @ts-ignore - Type compatibility in test
        { path: 'content/large.md', sha: 'sha2', size: 2000, type: 'entry', name: 'large.md' },
      ];

      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path === '/settings/api') {
          return { default_paging_num: 30, default_max_blob_size: 1000 };
        }

        if (path.startsWith('/repos/test-owner/test-repo/raw/')) {
          return 'Complete content of large.md';
        }

        return [{ path: 'content/small.md', content: 'QQ==', encoding: 'base64' }];
      });

      vi.mocked(decodeBase64).mockResolvedValue('Content of small.md');

      const result = await fetchFileContents(fetchingFiles);

      // Only the file within the limit is requested in bulk
      expect(fetchAPI).toHaveBeenCalledWith('/repos/test-owner/test-repo/file-contents?ref=main', {
        method: 'POST',
        body: { files: ['content/small.md'] },
      });

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/raw/content/large.md?ref=main',
        { responseType: 'text' },
      );

      expect(result['content/small.md'].text).toBe('Content of small.md');
      expect(result['content/large.md']).toEqual({
        sha: 'sha2',
        size: 2000,
        text: 'Complete content of large.md',
        meta: {},
      });
      expect(progressValues).toContain(100);
    });

    test('should encode the path of an oversized blob segment by segment', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'content/c#/a?b.md', sha: 'sha1', size: 2000, type: 'entry', name: 'a?b.md' },
      ];

      vi.mocked(fetchAPI).mockImplementation(async (path) =>
        path === '/settings/api' ? { default_max_blob_size: 1000 } : 'Content',
      );

      await fetchFileContents(fetchingFiles);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/raw/content/c%23/a%3Fb.md?ref=main',
        { responseType: 'text' },
      );
    });

    test('should keep a batch within the item limit the instance reports', async () => {
      /** @type {BaseFileListItem[]} */
      // @ts-ignore - Type compatibility in test
      const fetchingFiles = Array.from({ length: 6 }, (_, i) => ({
        path: `file${i}.md`,
        sha: `sha${i}`,
        size: 100,
        type: 'entry',
        name: `file${i}.md`,
      }));

      // An instance can be configured to page more items than it will actually return
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ default_paging_num: 30, max_response_items: 4 })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await fetchFileContents(fetchingFiles);

      expect(vi.mocked(fetchAPI).mock.calls[1][1]?.body).toEqual({
        files: ['file0.md', 'file1.md', 'file2.md', 'file3.md'],
      });
      expect(vi.mocked(fetchAPI).mock.calls[2][1]?.body).toEqual({
        files: ['file4.md', 'file5.md'],
      });
    });

    test('should keep a batch within the combined response size', async () => {
      /** @type {BaseFileListItem[]} */
      // @ts-ignore - Type compatibility in test
      const fetchingFiles = Array.from({ length: 3 }, (_, i) => ({
        path: `file${i}.md`,
        sha: `sha${i}`,
        size: 300,
        type: 'entry',
        name: `file${i}.md`,
      }));

      // Base64 turns each 300-byte file into 400 bytes, so only two fit in one response
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({
          default_paging_num: 30,
          default_max_blob_size: 1000,
          default_max_response_size: 1000,
        })
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await fetchFileContents(fetchingFiles);

      expect(vi.mocked(fetchAPI).mock.calls[1][1]?.body).toEqual({
        files: ['file0.md', 'file1.md'],
      });
      expect(vi.mocked(fetchAPI).mock.calls[2][1]?.body).toEqual({ files: ['file2.md'] });
    });

    test('should skip the bulk request when every file is oversized', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'content/large.md', sha: 'sha1', size: 2000, type: 'entry', name: 'large.md' },
      ];

      vi.mocked(fetchAPI).mockImplementation(async (path) =>
        path === '/settings/api'
          ? { default_paging_num: 30, default_max_blob_size: 1000 }
          : 'Complete content',
      );

      const result = await fetchFileContents(fetchingFiles);

      // The settings request and the raw one, with no bulk request in between
      expect(fetchAPI).toHaveBeenCalledTimes(2);
      expect(result['content/large.md'].text).toBe('Complete content');
    });

    test('should return empty object when no files to fetch', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'image.jpg', sha: 'def456', size: 200, type: 'asset', name: 'image.jpg' },
      ];

      const result = await fetchFileContents(fetchingFiles);

      expect(result).toEqual({});
      expect(fetchAPI).not.toHaveBeenCalled();
    });
  });

  describe('fetchFiles', () => {
    /**
     * Get the access check handed to the shared fetch function by the last `fetchFiles()` call.
     * @returns {() => Promise<void>} Access check.
     */
    const getCheckAccess = () =>
      /** @type {() => Promise<void>} */ (
        vi.mocked(fetchAndParseFiles).mock.calls[0][0].checkAccess
      );

    test('should orchestrate the complete file fetching process', async () => {
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      // The checks are handed over so they can run alongside the branch and commit requests
      expect(fetchAndParseFiles).toHaveBeenCalledWith({
        repository,
        checkAccess: expect.any(Function),
        checkBranchAccess,
        fetchDefaultBranchName,
        fetchLastCommit,
        fetchFileList,
        fetchFileContents,
      });
    });

    test('should check the instance version and the repository access at the same time', async () => {
      const { promise, resolve } = Promise.withResolvers();

      vi.mocked(checkInstanceVersion).mockReturnValue(/** @type {Promise<void>} */ (promise));
      vi.mocked(checkRepositoryAccess).mockResolvedValue();
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      const checking = getCheckAccess()();

      // The repository is checked while the version check is still in flight
      expect(checkRepositoryAccess).toHaveBeenCalled();
      resolve(undefined);
      await expect(checking).resolves.toBeUndefined();
    });

    test('should set up Open Authoring instead of the plain access check when configured', async () => {
      vi.mocked(isOpenAuthoringConfigured).mockReturnValue(true);
      vi.mocked(checkInstanceVersion).mockResolvedValue();
      vi.mocked(initOpenAuthoring).mockResolvedValue();
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      // The version check comes first, because the set-up asks the instance for what only a
      // supported version offers. The repository is read through the fork set-up, so no separate
      // access check is handed over
      expect(checkInstanceVersion).toHaveBeenCalledBefore(vi.mocked(initOpenAuthoring));
      expect(checkRepositoryAccess).not.toHaveBeenCalled();
      expect(vi.mocked(fetchAndParseFiles).mock.calls[0][0].checkAccess).toBeUndefined();
    });

    test('should set the fork up once, however often the files are fetched', async () => {
      vi.mocked(isOpenAuthoringConfigured).mockReturnValue(true);
      vi.mocked(checkInstanceVersion).mockResolvedValue();
      vi.mocked(initOpenAuthoring).mockImplementation(async () => {
        openAuthoringInitialized.current = true;
      });
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();
      await fetchFiles();

      // Setting it up again would reset the fork state a workflow commit may be relying on
      expect(initOpenAuthoring).toHaveBeenCalledTimes(1);
    });

    test('should leave the branch check out for a contributor', async () => {
      vi.mocked(isOpenAuthoringConfigured).mockReturnValue(true);
      vi.mocked(checkInstanceVersion).mockResolvedValue();
      vi.mocked(initOpenAuthoring).mockImplementation(async () => {
        forkedRepository.current = { owner: 'me', repo: 'repo' };
      });
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      // Their changes go to their fork, so the branch they can’t push to doesn’t matter
      expect(vi.mocked(fetchAndParseFiles).mock.calls[0][0].checkBranchAccess).toBeUndefined();
    });

    test('should report an unsupported instance before a repository access error', async () => {
      vi.mocked(checkInstanceVersion).mockRejectedValue(new Error('Version check failed'));
      vi.mocked(checkRepositoryAccess).mockRejectedValue(new Error('Access denied'));
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      await expect(getCheckAccess()()).rejects.toThrow('Version check failed');
    });

    test('should handle errors from repository access check', async () => {
      vi.mocked(checkInstanceVersion).mockResolvedValue();

      const error = new Error('Access denied');

      vi.mocked(checkRepositoryAccess).mockRejectedValue(error);
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      await expect(getCheckAccess()()).rejects.toThrow('Access denied');
    });
  });

  describe('branch name encoding', () => {
    // Left as is, `#` would start a fragment and cut the request URL short
    const branch = 'release#1';

    /**
     * Run the given function with the configured branch replaced.
     * @param {() => Promise<any>} fn Function to run.
     */
    const withBranch = async (fn) => {
      repository.branch = branch;

      try {
        await fn();
      } finally {
        repository.branch = 'main';
      }
    };

    test('encodes the branch in the file list request', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ tree: [], truncated: false });

      await withBranch(() => fetchFileList());

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/git/trees/release%231?recursive=1&page=1',
      );
    });

    test('encodes the branch in the bulk file contents request', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ default_paging_num: 30 })
        .mockResolvedValueOnce([]);

      await withBranch(() =>
        fetchFileContents([
          // @ts-ignore - Type compatibility in test
          { path: 'file1.md', sha: 'abc123', size: 100, type: 'entry', name: 'file1.md' },
        ]),
      );

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        '/repos/test-owner/test-repo/file-contents?ref=release%231',
        { method: 'POST', body: { files: ['file1.md'] } },
      );
    });

    test('encodes the branch in the media request', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(new Blob([]));

      await withBranch(() =>
        fetchBlob(/** @type {any} */ ({ path: 'images/photo.jpg', name: 'photo.jpg' })),
      );

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/media/release%231/images/photo.jpg',
        { responseType: 'blob' },
      );
    });
  });

  describe('fetchRawFile', () => {
    test('should read the file from the configured branch by default', async () => {
      vi.mocked(fetchAPI).mockResolvedValue('# Hello');

      await expect(fetchRawFile('content/posts/hello.md')).resolves.toBe('# Hello');

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/raw/content/posts/hello.md?ref=main',
        { responseType: 'text' },
      );
    });

    test('should read the file from the given branch', async () => {
      vi.mocked(fetchAPI).mockResolvedValue('# Hello');

      await fetchRawFile('content/posts/hello.md', 'cms/posts/hello');

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/raw/content/posts/hello.md?ref=cms%2Fposts%2Fhello',
        { responseType: 'text' },
      );
    });

    test('should read a workflow branch from the contributor’s fork', async () => {
      vi.mocked(getWorkflowRepository).mockReturnValue({ owner: 'me', repo: 'fork' });
      vi.mocked(fetchAPI).mockResolvedValue('# Hello');

      await fetchRawFile('content/posts/hello.md', 'cms/me/fork/posts/hello');

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/me/fork/raw/content/posts/hello.md?ref=cms%2Fme%2Ffork%2Fposts%2Fhello',
        { responseType: 'text' },
      );
    });

    test('should fall back to an empty ref without a configured branch', async () => {
      const { branch } = repository;

      repository.branch = undefined;
      vi.mocked(fetchAPI).mockResolvedValue('# Hello');

      await fetchRawFile('content/posts/hello.md');

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/raw/content/posts/hello.md?ref=',
        { responseType: 'text' },
      );

      repository.branch = branch;
    });
  });

  describe('fetchBlob', () => {
    test('should fetch asset blob from API', async () => {
      /** @type {Asset} */
      const mockAsset = {
        path: 'images/photo.jpg',
        sha: 'abc123',
        size: 1024,
        name: 'photo.jpg',
        kind: 'image',
        // @ts-ignore - Type compatibility in test
        folder: 'images',
      };

      const mockBlob = new Blob(['binary data'], { type: 'image/jpeg' });

      vi.mocked(fetchAPI).mockResolvedValue(mockBlob);

      const result = await fetchBlob(mockAsset);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/media/main/images/photo.jpg',
        { responseType: 'blob' },
      );
      expect(result).toBe(mockBlob);
    });

    test('should handle assets with special characters in path', async () => {
      /** @type {Asset} */
      const mockAsset = {
        path: 'images/photo with spaces & symbols.jpg',
        sha: 'abc123',
        size: 1024,
        name: 'photo with spaces & symbols.jpg',
        kind: 'image',
        // @ts-ignore - Type compatibility in test
        folder: 'images',
      };

      const mockBlob = new Blob(['binary data'], { type: 'image/jpeg' });

      vi.mocked(fetchAPI).mockResolvedValue(mockBlob);

      await fetchBlob(mockAsset);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/media/main/images/photo%20with%20spaces%20%26%20symbols.jpg',
        { responseType: 'blob' },
      );
    });

    test('should encode characters that would otherwise end the path', async () => {
      /** @type {Asset} */
      const mockAsset = {
        path: 'images/photo #1?.jpg',
        sha: 'abc123',
        size: 1024,
        name: 'photo #1?.jpg',
        kind: 'image',
        // @ts-ignore - Type compatibility in test
        folder: 'images',
      };

      vi.mocked(fetchAPI).mockResolvedValue(new Blob([]));

      await fetchBlob(mockAsset);

      // Left as is, `#` would start a fragment and `?` a query, cutting the path short
      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/media/main/images/photo%20%231%3F.jpg',
        { responseType: 'blob' },
      );
    });

    test('should read a contributor’s unpublished asset from their fork', async () => {
      vi.mocked(getWorkflowRepository).mockReturnValue({ owner: 'me', repo: 'fork' });
      vi.mocked(fetchAPI).mockResolvedValue(new Blob(['binary data']));

      await fetchBlob(
        /** @type {any} */ ({
          path: 'images/photo.jpg',
          workflow: { branch: 'cms/me/fork/posts/hello' },
        }),
      );

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/me/fork/media/cms/me/fork/posts/hello/images/photo.jpg',
        { responseType: 'blob' },
      );
    });

    test('should read an unpublished asset from its workflow branch', async () => {
      /** @type {Asset} */
      const mockAsset = {
        path: 'images/photo.jpg',
        sha: 'abc123',
        size: 1024,
        name: 'photo.jpg',
        kind: 'image',
        // @ts-ignore - Type compatibility in test
        folder: 'images',
        workflow: { branch: 'cms/posts/hello' },
      };

      vi.mocked(fetchAPI).mockResolvedValue(new Blob(['binary data']));

      await fetchBlob(mockAsset);

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/test-owner/test-repo/media/cms/posts/hello/images/photo.jpg',
        { responseType: 'blob' },
      );
    });
  });
});
