import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getAssetFoldersByPath } from '$lib/services/assets/folders';
import { getEntryFoldersByPath } from '$lib/services/contents';
import { isIndexFile } from '$lib/services/contents/file/process';

import { createFileList } from './process.js';

/**
 * @import {
 * AssetFolderInfo,
 * BaseFileListItemProps,
 * EntryFolderInfo,
 * } from '$lib/types/private.js'
 */

// Mock the external dependencies
vi.mock('$lib/services/assets/folders', () => ({
  getAssetFoldersByPath: vi.fn(),
}));

vi.mock('$lib/services/backends/git/shared/config', () => ({
  GIT_CONFIG_FILE_REGEX: /^\.git(attributes|keep)$/,
}));

vi.mock('$lib/services/contents', () => ({
  getEntryFoldersByPath: vi.fn(),
}));

vi.mock('$lib/services/contents/file/process', () => ({
  isIndexFile: vi.fn(),
}));

describe('Backend Process', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createFileList', () => {
    test('should return empty lists for empty input', () => {
      const result = createFileList([]);

      expect(result).toEqual({
        entryFiles: [],
        assetFiles: [],
        configFiles: [],
        allFiles: [],
        count: 0,
      });
    });

    test('should filter out hidden files that are not Git config files', () => {
      const files = [
        { path: '.hidden-file', name: '.hidden-file', size: 100, sha: 'hash1' },
        { path: '.secret', name: '.secret', size: 50, sha: 'hash2' },
      ];

      vi.mocked(getEntryFoldersByPath).mockReturnValue([]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      const result = createFileList(files);

      expect(result.allFiles).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    test('should include Git config files', () => {
      const files = [
        { path: '.gitattributes', name: '.gitattributes', size: 100, sha: 'hash1' },
        { path: '.gitkeep', name: '.gitkeep', size: 0, sha: 'hash2' },
        { path: '.gitignore', name: '.gitignore', size: 50, sha: 'hash3' }, // Should be filtered out
      ];

      vi.mocked(getEntryFoldersByPath).mockReturnValue([]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      const result = createFileList(files);

      expect(result.configFiles).toHaveLength(2);
      expect(result.configFiles[0]).toMatchObject({
        path: '.gitattributes',
        name: '.gitattributes',
        type: 'config',
      });
      expect(result.configFiles[1]).toMatchObject({
        path: '.gitkeep',
        name: '.gitkeep',
        type: 'config',
      });
      expect(result.allFiles).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    test('should categorize entry files correctly', () => {
      /** @type {BaseFileListItemProps[]} */
      const files = [
        { path: 'posts/hello.md', name: 'hello.md', size: 500, sha: 'hash1' },
        { path: 'pages/about.md', name: 'about.md', size: 300, sha: 'hash2' },
      ];

      /** @type {EntryFolderInfo} */
      const mockEntryFolder = {
        collectionName: 'posts',
        folderPath: 'posts',
      };

      vi.mocked(getEntryFoldersByPath).mockImplementation((path) => {
        if (path.startsWith('posts/')) return [mockEntryFolder];

        return [];
      });
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      const result = createFileList(files);

      expect(result.entryFiles).toHaveLength(1);
      expect(result.entryFiles[0]).toMatchObject({
        path: 'posts/hello.md',
        name: 'hello.md',
        type: 'entry',
        folder: mockEntryFolder,
      });
      expect(result.assetFiles).toHaveLength(0);
      expect(result.allFiles).toHaveLength(1);
    });

    test('should categorize asset files correctly', () => {
      /** @type {BaseFileListItemProps[]} */
      const files = [
        { path: 'images/photo.jpg', name: 'photo.jpg', size: 2000, sha: 'hash1' },
        { path: 'assets/logo.png', name: 'logo.png', size: 1500, sha: 'hash2' },
      ];

      /** @type {AssetFolderInfo} */
      const mockAssetFolder = {
        collectionName: undefined,
        internalPath: 'images',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      };

      vi.mocked(getEntryFoldersByPath).mockReturnValue([]);
      vi.mocked(getAssetFoldersByPath).mockImplementation((path) => {
        if (path.startsWith('images/')) return [mockAssetFolder];

        return [];
      });
      vi.mocked(isIndexFile).mockReturnValue(false);

      const result = createFileList(files);

      expect(result.assetFiles).toHaveLength(1);
      expect(result.assetFiles[0]).toMatchObject({
        path: 'images/photo.jpg',
        name: 'photo.jpg',
        type: 'asset',
        folder: mockAssetFolder,
      });
      expect(result.entryFiles).toHaveLength(0);
      expect(result.allFiles).toHaveLength(1);
    });

    test('should exclude files already listed as entries from assets', () => {
      /** @type {BaseFileListItemProps[]} */
      const files = [{ path: 'content/post.md', name: 'post.md', size: 500, sha: 'hash1' }];

      /** @type {EntryFolderInfo} */
      const mockEntryFolder = {
        collectionName: 'content',
        folderPath: 'content',
      };

      /** @type {AssetFolderInfo} */
      const mockAssetFolder = {
        collectionName: undefined,
        internalPath: 'content',
        publicPath: '/content',
        entryRelative: false,
        hasTemplateTags: false,
      };

      vi.mocked(getEntryFoldersByPath).mockReturnValue([mockEntryFolder]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([mockAssetFolder]);
      vi.mocked(isIndexFile).mockReturnValue(false);

      const result = createFileList(files);

      expect(result.entryFiles).toHaveLength(1);
      expect(result.assetFiles).toHaveLength(0); // Should be excluded
      expect(result.allFiles).toHaveLength(1);
    });

    test('should exclude Hugo index files from assets', () => {
      /** @type {BaseFileListItemProps[]} */
      const files = [{ path: 'content/_index.md', name: '_index.md', size: 200, sha: 'hash1' }];

      /** @type {AssetFolderInfo} */
      const mockAssetFolder = {
        collectionName: undefined,
        internalPath: 'content',
        publicPath: '/content',
        entryRelative: false,
        hasTemplateTags: false,
      };

      vi.mocked(getEntryFoldersByPath).mockReturnValue([]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([mockAssetFolder]);
      vi.mocked(isIndexFile).mockReturnValue(true); // Mock as Hugo index file

      const result = createFileList(files);

      expect(result.assetFiles).toHaveLength(0); // Should be excluded
      expect(result.entryFiles).toHaveLength(0);
      expect(result.allFiles).toHaveLength(0);
    });

    test('should handle mixed file types correctly', () => {
      /** @type {BaseFileListItemProps[]} */
      const files = [
        { path: 'posts/hello.md', name: 'hello.md', size: 500, sha: 'hash1' },
        { path: 'images/photo.jpg', name: 'photo.jpg', size: 2000, sha: 'hash2' },
        { path: '.gitattributes', name: '.gitattributes', size: 100, sha: 'hash3' },
        { path: '.hidden', name: '.hidden', size: 50, sha: 'hash4' },
      ];

      /** @type {EntryFolderInfo} */
      const mockEntryFolder = {
        collectionName: 'posts',
        folderPath: 'posts',
      };

      /** @type {AssetFolderInfo} */
      const mockAssetFolder = {
        collectionName: undefined,
        internalPath: 'images',
        publicPath: '/images',
        entryRelative: false,
        hasTemplateTags: false,
      };

      vi.mocked(getEntryFoldersByPath).mockImplementation((path) => {
        if (path.startsWith('posts/')) return [mockEntryFolder];

        return [];
      });
      vi.mocked(getAssetFoldersByPath).mockImplementation((path) => {
        if (path.startsWith('images/')) return [mockAssetFolder];

        return [];
      });
      vi.mocked(isIndexFile).mockReturnValue(false);

      const result = createFileList(files);

      expect(result.entryFiles).toHaveLength(1);
      expect(result.assetFiles).toHaveLength(1);
      expect(result.configFiles).toHaveLength(1);
      expect(result.allFiles).toHaveLength(3);
      expect(result.count).toBe(3);

      // Verify the order: entries, assets, config files
      expect(result.allFiles[0].type).toBe('entry');
      expect(result.allFiles[1].type).toBe('asset');
      expect(result.allFiles[2].type).toBe('config');
    });

    test('should preserve all file properties', () => {
      /** @type {BaseFileListItemProps[]} */
      const files = [
        {
          path: 'posts/hello.md',
          name: 'hello.md',
          size: 500,
          sha: 'abc123',
        },
      ];

      /** @type {EntryFolderInfo} */
      const mockEntryFolder = {
        collectionName: 'posts',
        folderPath: 'posts',
      };

      vi.mocked(getEntryFoldersByPath).mockReturnValue([mockEntryFolder]);
      vi.mocked(getAssetFoldersByPath).mockReturnValue([]);

      const result = createFileList(files);

      expect(result.entryFiles[0]).toMatchObject({
        path: 'posts/hello.md',
        name: 'hello.md',
        size: 500,
        sha: 'abc123',
        type: 'entry',
        folder: mockEntryFolder,
      });
    });
  });
});
