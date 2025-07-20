import { get } from 'svelte/store';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { allAssets } from '$lib/services/assets';
import { backend } from '$lib/services/backends';
import { allEntries } from '$lib/services/contents';
import { user } from '$lib/services/user';
import { getCommitAuthor, updateCache, updateStores, saveChanges } from './save.js';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * AssetKind,
 * CommitAction,
 * CommitOptions,
 * CommitType,
 * Entry,
 * FileChange,
 * } from '$lib/types/private.js'
 */

// Mock external dependencies
vi.mock('@sveltia/utils/storage', () => ({
  IndexedDB: vi.fn(() => ({
    delete: vi.fn(),
    set: vi.fn(),
  })),
}));

vi.mock('svelte/store', () => ({
  get: vi.fn(),
}));

vi.mock('$lib/services/assets', () => ({
  allAssets: {
    update: vi.fn(),
  },
}));

vi.mock('$lib/services/backends', () => ({
  backend: {},
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: {
    update: vi.fn(),
  },
}));

vi.mock('$lib/services/user', () => ({
  user: {},
}));

vi.mock('$lib/services/user/prefs', () => ({
  prefs: {},
}));

vi.mock('$lib/services/utils/file', () => ({
  getBlob: vi.fn(() => ({ size: 1024 })),
}));

describe('Backend Save', () => {
  const mockCommitChanges = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock behavior - return different objects for different stores
    vi.mocked(get).mockImplementation((store) => {
      // Check if this is the backend store
      if (store === backend) {
        return {
          commitChanges: mockCommitChanges,
          repository: { databaseName: 'test-db' },
        };
      }

      // Check if this is the user store
      if (store === user) {
        return {
          name: 'Test User',
          email: 'test@example.com',
          id: 'user123',
          login: 'testuser',
        };
      }

      // Default for other stores (like prefs)
      return {
        devModeEnabled: false,
      };
    });

    mockCommitChanges.mockResolvedValue({
      sha: 'commit123',
      date: new Date('2023-01-01T12:00:00Z'),
      files: {},
    });
  });

  describe('getCommitAuthor', () => {
    test('should return commit author when user has name and email', () => {
      vi.mocked(get).mockReturnValue({
        name: 'John Doe',
        email: 'john@example.com',
        id: 'user123',
        login: 'johndoe',
      });

      const result = getCommitAuthor();

      expect(result).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        id: 'user123',
        login: 'johndoe',
      });
    });

    test('should return undefined when user has no name', () => {
      vi.mocked(get).mockReturnValue({
        name: '',
        email: 'john@example.com',
        id: 'user123',
        login: 'johndoe',
      });

      const result = getCommitAuthor();

      expect(result).toBeUndefined();
    });

    test('should return undefined when user has no email', () => {
      vi.mocked(get).mockReturnValue({
        name: 'John Doe',
        email: '',
        id: 'user123',
        login: 'johndoe',
      });

      const result = getCommitAuthor();

      expect(result).toBeUndefined();
    });

    test('should return undefined when user has neither name nor email', () => {
      vi.mocked(get).mockReturnValue({
        name: '',
        email: '',
        id: 'user123',
        login: 'johndoe',
      });

      const result = getCommitAuthor();

      expect(result).toBeUndefined();
    });

    test('should return undefined when user is null', () => {
      vi.mocked(get).mockReturnValue(null);

      const result = getCommitAuthor();

      expect(result).toBeUndefined();
    });
  });

  describe('updateCache', () => {
    /** @type {any} */
    let mockCacheDB;

    beforeEach(async () => {
      mockCacheDB = {
        delete: vi.fn(),
        set: vi.fn(),
      };

      vi.mocked(get).mockReturnValue({
        repository: { databaseName: 'test-db' },
      });

      // Mock IndexedDB to return our mock
      const { IndexedDB } = await import('@sveltia/utils/storage');

      vi.mocked(IndexedDB).mockReturnValue(mockCacheDB);
    });

    test('should return early when no database name is available', async () => {
      vi.mocked(get).mockReturnValue({
        repository: {},
      });

      await updateCache({
        changes: [],
        commit: { sha: 'commit-sha', files: {}, author: undefined, date: new Date() },
      });

      expect(mockCacheDB.delete).not.toHaveBeenCalled();
      expect(mockCacheDB.set).not.toHaveBeenCalled();
    });

    test('should return early when backend is null', async () => {
      vi.mocked(get).mockReturnValue(null);

      await updateCache({
        changes: [],
        commit: { sha: 'commit-sha', files: {}, author: undefined, date: new Date() },
      });

      expect(mockCacheDB.delete).not.toHaveBeenCalled();
      expect(mockCacheDB.set).not.toHaveBeenCalled();
    });

    test('should skip asset changes (non-string data)', async () => {
      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'images/photo.jpg',
          data: new File(['fake image data'], 'photo.jpg'),
        },
      ];

      await updateCache({
        changes,
        commit: { sha: 'commit-sha', files: {}, author: undefined, date: new Date() },
      });

      expect(mockCacheDB.delete).not.toHaveBeenCalled();
      expect(mockCacheDB.set).not.toHaveBeenCalled();
    });

    test('should skip changes without slug', async () => {
      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'config.yml',
          data: 'backend:\n  name: github',
        },
      ];

      await updateCache({
        changes,
        commit: { sha: 'commit-sha', files: {}, author: undefined, date: new Date() },
      });

      expect(mockCacheDB.delete).not.toHaveBeenCalled();
      expect(mockCacheDB.set).not.toHaveBeenCalled();
    });

    test('should delete file from cache when action is delete', async () => {
      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('delete'),
          path: 'posts/old-post.md',
          slug: 'old-post',
          data: '# Old Post',
        },
      ];

      await updateCache({
        changes,
        commit: { sha: 'commit-sha', files: {}, author: undefined, date: new Date() },
      });

      expect(mockCacheDB.delete).toHaveBeenCalledWith('posts/old-post.md');
      expect(mockCacheDB.set).not.toHaveBeenCalled();
    });

    test('should delete previous file and set new file when action is move', async () => {
      const commitDate = new Date('2023-01-01T12:00:00Z');
      const commitAuthor = { name: 'Test User', email: 'test@example.com' };

      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('move'),
          path: 'posts/new-path.md',
          previousPath: 'posts/old-path.md',
          slug: 'test-post',
          data: '# Test Post',
        },
      ];

      const commit = {
        sha: 'commit-sha',
        files: {
          'posts/new-path.md': { sha: 'abc123' },
        },
        author: commitAuthor,
        date: commitDate,
      };

      await updateCache({ changes, commit });

      expect(mockCacheDB.delete).toHaveBeenCalledWith('posts/old-path.md');
      expect(mockCacheDB.set).toHaveBeenCalledWith('posts/new-path.md', {
        sha: 'abc123',
        size: 1024,
        text: '# Test Post',
        meta: { commitAuthor, commitDate },
      });
    });

    test('should set file in cache when action is create or update', async () => {
      const commitDate = new Date('2023-01-01T12:00:00Z');
      const commitAuthor = { name: 'Test User', email: 'test@example.com' };

      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'posts/new-post.md',
          slug: 'new-post',
          data: '# New Post\nContent here',
        },
        {
          action: /** @type {CommitAction} */ ('update'),
          path: 'posts/existing-post.md',
          slug: 'existing-post',
          data: '# Updated Post\nUpdated content',
        },
      ];

      const commit = {
        sha: 'commit-sha',
        files: {
          'posts/new-post.md': { sha: 'def456' },
          'posts/existing-post.md': { sha: 'ghi789' },
        },
        author: commitAuthor,
        date: commitDate,
      };

      await updateCache({ changes, commit });

      expect(mockCacheDB.set).toHaveBeenCalledWith('posts/new-post.md', {
        sha: 'def456',
        size: 1024,
        text: '# New Post\nContent here',
        meta: { commitAuthor, commitDate },
      });

      expect(mockCacheDB.set).toHaveBeenCalledWith('posts/existing-post.md', {
        sha: 'ghi789',
        size: 1024,
        text: '# Updated Post\nUpdated content',
        meta: { commitAuthor, commitDate },
      });
    });

    test('should handle missing file information in commit', async () => {
      const commitDate = new Date('2023-01-01T12:00:00Z');
      const commitAuthor = { name: 'Test User', email: 'test@example.com' };

      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'posts/new-post.md',
          slug: 'new-post',
          data: '# New Post',
        },
      ];

      const commit = {
        sha: 'commit-sha',
        files: {}, // No file information
        author: commitAuthor,
        date: commitDate,
      };

      await updateCache({ changes, commit });

      expect(mockCacheDB.set).toHaveBeenCalledWith('posts/new-post.md', {
        sha: undefined,
        size: 1024,
        text: '# New Post',
        meta: { commitAuthor, commitDate },
      });
    });
  });

  describe('updateStores', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    test('should update allEntries store by replacing saved entries', () => {
      /** @type {Entry[]} */
      const existingEntries = [
        // @ts-ignore - Minimal test objects
        { id: 'entry1', slug: 'post-1', subPath: 'post-1', locales: {} },
        // @ts-ignore - Minimal test objects
        { id: 'entry2', slug: 'post-2', subPath: 'post-2', locales: {} },
        // @ts-ignore - Minimal test objects
        { id: 'entry3', slug: 'post-3', subPath: 'post-3', locales: {} },
      ];

      /** @type {Entry[]} */
      const savedEntries = [
        // @ts-ignore - Minimal test objects
        { id: 'entry2', slug: 'updated-post-2', subPath: 'updated-post-2', locales: {} }, // Updated entry
        // @ts-ignore - Minimal test objects
        { id: 'entry4', slug: 'new-post-4', subPath: 'new-post-4', locales: {} }, // New entry
      ];

      /** @type {FileChange[]} */
      const changes = [];
      /** @type {Asset[]} */
      const savedAssets = [];
      // Mock the update callback to capture and test the result
      let actualResult;

      vi.mocked(allEntries.update).mockImplementation((callback) => {
        actualResult = callback(existingEntries);
        return actualResult;
      });

      updateStores({ changes, savedEntries, savedAssets });

      // The function should filter out entries that match saved entry IDs, then add saved entries
      expect(actualResult).toEqual([
        // @ts-ignore - Minimal test objects
        { id: 'entry1', slug: 'post-1', subPath: 'post-1', locales: {} }, // Not in savedEntries, so kept
        // @ts-ignore - Minimal test objects
        { id: 'entry3', slug: 'post-3', subPath: 'post-3', locales: {} }, // Not in savedEntries, so kept
        // @ts-ignore - Minimal test objects
        { id: 'entry2', slug: 'updated-post-2', subPath: 'updated-post-2', locales: {} }, // Saved entry (replaces old entry2)
        // @ts-ignore - Minimal test objects
        { id: 'entry4', slug: 'new-post-4', subPath: 'new-post-4', locales: {} }, // New saved entry
      ]);
      expect(allEntries.update).toHaveBeenCalledTimes(1);
    });

    test('should update allAssets store by filtering out moved, deleted, and saved assets', () => {
      /** @type {Asset[]} */
      const existingAssets = [
        {
          path: 'images/photo1.jpg',
          name: 'photo1.jpg',
          sha: 'sha1',
          size: 100,
          kind: 'image',
          // @ts-ignore - Minimal test objects
          folder: {},
        },
        {
          path: 'images/photo2.jpg',
          name: 'photo2.jpg',
          sha: 'sha2',
          size: 200,
          kind: 'image',
          // @ts-ignore - Minimal test objects
          folder: {},
        },
        {
          path: 'images/photo3.jpg',
          name: 'photo3.jpg',
          sha: 'sha3',
          size: 300,
          kind: 'image',
          // @ts-ignore - Minimal test objects
          folder: {},
        },
        {
          path: 'images/old-photo.jpg',
          name: 'old-photo.jpg',
          sha: 'sha4',
          size: 400,
          kind: 'image',
          // @ts-ignore - Minimal test objects
          folder: {},
        },
        {
          path: 'images/to-delete.jpg',
          name: 'to-delete.jpg',
          sha: 'sha5',
          size: 500,
          kind: 'image',
          // @ts-ignore - Minimal test objects
          folder: {},
        },
      ];

      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('move'),
          path: 'images/new-photo.jpg',
          previousPath: 'images/old-photo.jpg',
        },
        { action: /** @type {CommitAction} */ ('delete'), path: 'images/to-delete.jpg' },
      ];

      /** @type {Asset[]} */
      const savedAssets = [
        {
          path: 'images/photo2.jpg',
          name: 'updated-photo2.jpg',
          sha: 'sha2',
          size: 200,
          kind: 'image',
          // @ts-ignore - Minimal test objects
          folder: {},
        }, // Updated asset
        {
          path: 'images/new-photo4.jpg',
          name: 'photo4.jpg',
          sha: 'sha6',
          size: 600,
          kind: 'image',
          // @ts-ignore - Minimal test objects
          folder: {},
        }, // New asset
      ];

      /** @type {Entry[]} */
      const savedEntries = [];
      // Mock the update callback to capture and test the result
      let actualResult;

      vi.mocked(allAssets.update).mockImplementation((callback) => {
        actualResult = callback(existingAssets);
        return actualResult;
      });

      updateStores({ changes, savedEntries, savedAssets });

      // Should filter out:
      // - images/photo2.jpg (in savedAssets paths)
      // - images/old-photo.jpg (in movedAssetPaths)
      // - images/to-delete.jpg (in deletedAssetPaths)
      // - images/new-photo4.jpg (in savedAssets paths, but wasn't in existing anyway)
      expect(actualResult).toEqual([
        // @ts-ignore - Minimal test objects
        {
          path: 'images/photo1.jpg',
          name: 'photo1.jpg',
          sha: 'sha1',
          size: 100,
          kind: 'image',
          folder: {},
        },
        // @ts-ignore - Minimal test objects
        {
          path: 'images/photo3.jpg',
          name: 'photo3.jpg',
          sha: 'sha3',
          size: 300,
          kind: 'image',
          folder: {},
        },
        // Saved assets are added at the end
        // @ts-ignore - Minimal test objects
        {
          path: 'images/photo2.jpg',
          name: 'updated-photo2.jpg',
          sha: 'sha2',
          size: 200,
          kind: 'image',
          folder: {},
        },
        // @ts-ignore - Minimal test objects
        {
          path: 'images/new-photo4.jpg',
          name: 'photo4.jpg',
          sha: 'sha6',
          size: 600,
          kind: 'image',
          folder: {},
        },
      ]);
      expect(allAssets.update).toHaveBeenCalledTimes(1);
    });

    test('should handle empty arrays', () => {
      /** @type {Entry[]} */
      const existingEntries = [
        // @ts-ignore - Minimal test objects
        { id: 'entry1', slug: 'post-1', subPath: 'post-1', locales: {} },
      ];

      /** @type {Asset[]} */
      const existingAssets = [
        {
          path: 'images/photo1.jpg',
          name: 'photo1.jpg',
          sha: 'sha1',
          size: 100,
          kind: 'image',
          // @ts-ignore - Minimal test objects
          folder: {},
        },
      ];

      // Mock the update callbacks to capture results
      let entriesResult;
      let assetsResult;

      vi.mocked(allEntries.update).mockImplementation((callback) => {
        entriesResult = callback(existingEntries);
        return entriesResult;
      });

      vi.mocked(allAssets.update).mockImplementation((callback) => {
        assetsResult = callback(existingAssets);
        return assetsResult;
      });

      updateStores({
        changes: [],
        savedEntries: [],
        savedAssets: [],
      });

      expect(entriesResult).toEqual(existingEntries); // No changes because no saved entries
      expect(assetsResult).toEqual(existingAssets); // No changes because no saved assets or changes
      expect(allEntries.update).toHaveBeenCalledTimes(1);
      expect(allAssets.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveChanges', () => {
    test('should commit changes and return results', async () => {
      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'posts/new-post.md',
          slug: 'new-post',
          data: '# New Post\nContent here',
        },
      ];

      /** @type {Entry[]} */
      const savingEntries = [
        // @ts-ignore - Minimal test object
        {
          id: 'entry1',
          slug: 'new-post',
          subPath: 'new-post',
          locales: {},
        },
      ];

      /** @type {CommitOptions} */
      const options = {
        commitType: /** @type {CommitType} */ ('create'),
      };

      // @ts-ignore - Type issues in test
      const result = await saveChanges({
        changes,
        savingEntries,
        savingAssets: [],
        options,
      });

      expect(mockCommitChanges).toHaveBeenCalledWith(changes, options);
      expect(result).toHaveProperty('commit');
      expect(result).toHaveProperty('savedEntries');
      expect(result).toHaveProperty('savedAssets');
      expect(result.savedEntries).toHaveLength(1);
    });

    test('should handle asset changes', async () => {
      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'images/photo.jpg',
          data: new File(['fake image data'], 'photo.jpg'),
        },
      ];

      /** @type {Asset[]} */
      const savingAssets = [
        // @ts-ignore - Minimal test object
        {
          path: 'images/photo.jpg',
          name: 'photo.jpg',
          size: 1024,
          sha: 'test-sha',
          kind: /** @type {AssetKind} */ ('image'),
          folder: /** @type {AssetFolderInfo} */ ({
            collectionName: undefined,
            internalPath: 'images',
            publicPath: '/images',
            entryRelative: false,
            hasTemplateTags: false,
          }),
        },
      ];

      mockCommitChanges.mockResolvedValue({
        sha: 'commit456',
        date: new Date('2023-01-01T12:00:00Z'),
        files: {
          'images/photo.jpg': {
            sha: 'file123',
            file: new File(['fake image data'], 'photo.jpg'),
          },
        },
      });

      /** @type {CommitOptions} */
      const options = {
        commitType: /** @type {CommitType} */ ('create'),
      };

      // @ts-ignore - Type issues in test
      const result = await saveChanges({
        changes,
        savingEntries: [],
        savingAssets,
        options,
      });

      expect(result.savedAssets).toHaveLength(1);
      expect(result.savedAssets[0]).toMatchObject({
        path: 'images/photo.jpg',
        name: 'photo.jpg',
        sha: 'file123',
      });
    });

    test('should handle missing user information', async () => {
      // Setup separate mock for this test
      vi.mocked(get).mockImplementation((store) => {
        // Check if this is the backend store
        if (store === backend) {
          return {
            commitChanges: mockCommitChanges,
            repository: { databaseName: 'test-db' },
          };
        }

        // Check if this is the user store - return user with empty name/email
        if (store === user) {
          return {
            name: '', // Empty name
            email: '', // Empty email
            id: 'user123',
            login: 'testuser',
          };
        }

        // Default for other stores (like prefs)
        return {
          devModeEnabled: false,
        };
      });

      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'posts/test.md',
          slug: 'test',
          data: '# Test',
        },
      ];

      /** @type {Entry[]} */
      const savingEntries = [
        // @ts-ignore - Minimal test object
        {
          id: 'entry1',
          slug: 'test',
          subPath: 'test',
          locales: {},
        },
      ];

      /** @type {CommitOptions} */
      const options = {
        commitType: /** @type {CommitType} */ ('create'),
      };

      // @ts-ignore - Type issues in test
      const result = await saveChanges({
        changes,
        savingEntries,
        savingAssets: [],
        options,
      });

      expect(result.savedEntries[0].commitAuthor).toBeUndefined();
    });

    test('should update stores', async () => {
      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'posts/new.md',
          slug: 'new',
          data: '# New',
        },
      ];

      /** @type {CommitOptions} */
      const options = {
        commitType: /** @type {CommitType} */ ('create'),
      };

      // @ts-ignore - Type issues in test
      await saveChanges({
        changes,
        savingEntries: [],
        savingAssets: [],
        options,
      });

      expect(vi.mocked(allEntries.update)).toHaveBeenCalled();
      expect(vi.mocked(allAssets.update)).toHaveBeenCalled();
    });

    test('should log debug information when devMode is enabled', async () => {
      // Mock console.debug to track debug calls
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      // Setup separate mock for this test with devModeEnabled = true
      vi.mocked(get).mockImplementation((store) => {
        if (store === backend) {
          return {
            commitChanges: mockCommitChanges,
            repository: { databaseName: 'test-db' },
          };
        }

        if (store === user) {
          return {
            name: 'Test User',
            email: 'test@example.com',
            id: 'user123',
            login: 'testuser',
          };
        }

        // Mock prefs with devModeEnabled = true
        return {
          devModeEnabled: true,
        };
      });

      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'posts/debug-test.md',
          slug: 'debug-test',
          data: '# Debug Test',
        },
      ];

      /** @type {CommitOptions} */
      const options = {
        commitType: /** @type {CommitType} */ ('create'),
      };

      // @ts-ignore - Type issues in test
      await saveChanges({
        changes,
        savingEntries: [],
        savingAssets: [],
        options,
      });

      // Verify that console.debug was called twice (for changes and commit results)
      expect(consoleSpy).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith('Commit changes:', changes);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Commit results:',
        expect.objectContaining({
          author: expect.any(Object),
          sha: 'commit123',
          date: expect.any(Date),
        }),
      );

      // Clean up
      consoleSpy.mockRestore();
    });
  });
});
