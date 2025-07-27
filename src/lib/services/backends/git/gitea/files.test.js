// @vitest-environment jsdom

import { decodeBase64, getPathInfo } from '@sveltia/utils/file';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchLastCommit } from '$lib/services/backends/git/gitea/commits';
import { checkInstanceVersion, instance } from '$lib/services/backends/git/gitea/instance';
import {
  checkRepositoryAccess,
  fetchDefaultBranchName,
  repository,
} from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { fetchAndParseFiles } from '$lib/services/backends/git/shared/fetch';
import { dataLoadedProgress } from '$lib/services/contents';

import {
  fetchBlob,
  fetchFileContents,
  fetchFileList,
  fetchFiles,
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
  checkRepositoryAccess: vi.fn(),
  fetchDefaultBranchName: vi.fn(),
}));

vi.mock('$lib/services/backends/git/shared/api', () => ({
  fetchAPI: vi.fn(),
}));

vi.mock('$lib/services/backends/git/shared/fetch', () => ({
  fetchAndParseFiles: vi.fn(),
}));

vi.mock('$lib/services/contents', () => ({
  dataLoadedProgress: { set: vi.fn() },
}));

describe('Gitea Files Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset instance to default state
    vi.mocked(instance).isForgejo = false;
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

      const results = [
        { content: 'SGVsbG8gd29ybGQ=', encoding: 'base64' },
        { content: 'VGVzdCBjb250ZW50', encoding: 'base64' },
      ];

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
        { path: 'file1.md', sha: 'abc123', size: 0, type: 'entry', name: 'file1.md' },
      ];

      const results = [null];
      // @ts-ignore - Type compatibility in test
      const result = await parseFileContents(fetchingFiles, results);

      expect(result).toEqual({
        'file1.md': {
          sha: 'abc123',
          size: 0,
          text: '',
          meta: {},
        },
      });
    });

    test('should handle files with non-base64 encoding', async () => {
      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'file1.md', sha: 'abc123', size: 100, type: 'entry', name: 'file1.md' },
      ];

      const results = [{ content: 'plain text', encoding: null }];
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

      const results = /** @type {import('./files.js').PartialContentsListItem[]} */ ([
        { content: 'SGVsbG8=', encoding: 'base64' },
      ]);

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
        { content: 'SGVsbG8gd29ybGQ=', encoding: 'base64' },
        { content: 'VGVzdCBjb250ZW50', encoding: 'base64' },
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
      expect(dataLoadedProgress.set).toHaveBeenCalledWith(0);
      expect(dataLoadedProgress.set).toHaveBeenCalledWith(100);
      expect(dataLoadedProgress.set).toHaveBeenCalledWith(undefined);
    });

    test('should fetch file contents for Forgejo', async () => {
      // Mock Forgejo instance
      vi.mocked(instance).isForgejo = true;

      /** @type {BaseFileListItem[]} */
      const fetchingFiles = [
        // @ts-ignore - Type compatibility in test
        { path: 'file1.md', sha: 'abc123', size: 100, type: 'entry', name: 'file1.md' },
      ];

      const mockResults = [{ content: 'SGVsbG8gd29ybGQ=', encoding: 'base64' }];

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
        .mockResolvedValueOnce(Array(30).fill({ content: 'dGVzdA==', encoding: 'base64' }))
        .mockResolvedValueOnce(Array(5).fill({ content: 'dGVzdA==', encoding: 'base64' }));

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
        .mockResolvedValueOnce([{ content: 'dGVzdA==', encoding: 'base64' }]);

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
    test('should orchestrate the complete file fetching process', async () => {
      vi.mocked(checkInstanceVersion).mockResolvedValue();
      vi.mocked(checkRepositoryAccess).mockResolvedValue();
      vi.mocked(fetchAndParseFiles).mockResolvedValue();

      await fetchFiles();

      expect(checkInstanceVersion).toHaveBeenCalled();
      expect(checkRepositoryAccess).toHaveBeenCalled();
      expect(fetchAndParseFiles).toHaveBeenCalledWith({
        repository,
        fetchDefaultBranchName,
        fetchLastCommit,
        fetchFileList,
        fetchFileContents,
      });
    });

    test('should handle errors from instance version check', async () => {
      const error = new Error('Version check failed');

      vi.mocked(checkInstanceVersion).mockRejectedValue(error);

      await expect(fetchFiles()).rejects.toThrow('Version check failed');
      expect(checkRepositoryAccess).not.toHaveBeenCalled();
    });

    test('should handle errors from repository access check', async () => {
      vi.mocked(checkInstanceVersion).mockResolvedValue();

      const error = new Error('Access denied');

      vi.mocked(checkRepositoryAccess).mockRejectedValue(error);

      await expect(fetchFiles()).rejects.toThrow('Access denied');
      expect(fetchAndParseFiles).not.toHaveBeenCalled();
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
        '/repos/test-owner/test-repo/media/main/images/photo%20with%20spaces%20&%20symbols.jpg',
        { responseType: 'blob' },
      );
    });
  });
});
