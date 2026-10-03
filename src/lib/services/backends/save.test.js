import { beforeEach, describe, expect, test, vi } from 'vitest';

import { allAssets } from '$lib/services/assets/state';
import { backend } from '$lib/services/backends';
import { repositoryHead } from '$lib/services/backends/git/shared/fetch';
import { checkForRemoteChanges, suspendChecksWhile } from '$lib/services/backends/refresh';
import { allEntries } from '$lib/services/contents';
import { combineArrayFileChanges, createArrayFileEntries } from '$lib/services/contents/file/array';

import { getCommitAuthor, saveChanges, updateCache, updateStores } from './save.js';

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

vi.mock('$lib/services/assets/state', () => ({
  allAssets: { current: [] },
}));

vi.mock('$lib/services/assets/info', () => ({
  cacheAssetBlob: vi.fn(async (asset, blob) => {
    asset.blobURL ??= 'blob:http://localhost/display-url';

    return blob;
  }),
}));

vi.mock('$lib/services/backends', () => ({
  backend: { current: undefined },
}));

vi.mock('$lib/services/backends/git/shared/fetch', () => ({
  repositoryHead: { current: '' },
}));

vi.mock('$lib/services/backends/refresh', () => ({
  checkForRemoteChanges: vi.fn(),
  suspendChecksWhile: vi.fn((commit) => commit()),
}));

vi.mock('$lib/services/contents', () => ({
  allEntries: { current: [] },
}));

vi.mock('$lib/services/contents/file/array', () => ({
  combineArrayFileChanges: vi.fn(),
  createArrayFileEntries: vi.fn(),
}));

const mockUserState = vi.hoisted(() => ({
  account: /** @type {any} */ ({
    name: 'Test User',
    email: 'test@example.com',
    id: 'user123',
    login: 'testuser',
  }),
}));

vi.mock('$lib/services/user/account.svelte', () => ({
  user: mockUserState,
}));

const mockPrefs = vi.hoisted(() => ({ devModeEnabled: false }));

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: mockPrefs,
}));

vi.mock('$lib/services/utils/file', () => ({
  getByteSize: vi.fn(() => 1024),
}));

vi.mock('@sveltia/utils/storage');

describe('save', () => {
  const mockCommitChanges = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(suspendChecksWhile).mockImplementation((commit) => commit());
    vi.mocked(combineArrayFileChanges).mockImplementation(async (changes) => ({
      changes,
      arrayFileUpdates: [],
    }));
    vi.mocked(createArrayFileEntries).mockReturnValue({ entries: [], savedEntries: new Map() });
    repositoryHead.current = '';
    mockPrefs.devModeEnabled = false;
    mockUserState.account = {
      name: 'Test User',
      email: 'test@example.com',
      id: 'user123',
      login: 'testuser',
    };

    /** @type {any} */ (backend).current = {
      commitChanges: mockCommitChanges,
      repository: { databaseName: 'test-db' },
    };

    mockCommitChanges.mockResolvedValue({
      sha: 'commit123',
      date: new Date('2023-01-01T12:00:00Z'),
      files: {},
    });
  });

  describe('getCommitAuthor', () => {
    test('should return commit author when user has name and email', () => {
      mockUserState.account = {
        name: 'John Doe',
        email: 'john@example.com',
        id: 'user123',
        login: 'johndoe',
      };

      const result = getCommitAuthor();

      expect(result).toEqual({
        name: 'John Doe',
        email: 'john@example.com',
        id: 'user123',
        login: 'johndoe',
      });
    });

    test('should return undefined when user has no name', () => {
      mockUserState.account = {
        name: '',
        email: 'john@example.com',
        id: 'user123',
        login: 'johndoe',
      };

      const result = getCommitAuthor();

      expect(result).toBeUndefined();
    });

    test('should return undefined when user has no email', () => {
      mockUserState.account = {
        name: 'John Doe',
        email: '',
        id: 'user123',
        login: 'johndoe',
      };

      const result = getCommitAuthor();

      expect(result).toBeUndefined();
    });

    test('should return undefined when user has neither name nor email', () => {
      mockUserState.account = {
        name: '',
        email: '',
        id: 'user123',
        login: 'johndoe',
      };

      const result = getCommitAuthor();

      expect(result).toBeUndefined();
    });

    test('should return undefined when user is null', () => {
      mockUserState.account = null;

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

      /** @type {any} */ (backend).current = {
        repository: { databaseName: 'test-db' },
      };

      // Get the mocked IndexedDB constructor
      const { IndexedDB } = await import('@sveltia/utils/storage');

      // Create a mock constructor class that returns our mockCacheDB
      /**
       * Mock IndexedDB constructor.
       * @returns {object} Mock cache database instance.
       */
      function MockIndexedDB() {
        return mockCacheDB;
      }

      // Replace the IndexedDB mock implementation
      vi.mocked(IndexedDB).mockImplementation(MockIndexedDB);
    });

    test('should return early when no database name is available', async () => {
      /** @type {any} */ (backend).current = {
        repository: {},
      };

      await updateCache({
        changes: [],
        commit: { sha: 'commit-sha', files: {}, author: undefined, date: new Date() },
      });

      // Test passes if no error is thrown
    });

    test('should return early when backend is null', async () => {
      /** @type {any} */ (backend).current = null;

      await updateCache({
        changes: [],
        commit: { sha: 'commit-sha', files: {}, author: undefined, date: new Date() },
      });

      // Test passes if no error is thrown
    });

    test('should cache an asset without text, so a later fetch knows its SHA', async () => {
      const date = new Date();
      const author = { name: 'Test User', email: 'test@example.com' };

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
        commit: {
          sha: 'commit-sha',
          files: { 'images/photo.jpg': { sha: 'asset-sha' } },
          author,
          date,
        },
      });

      expect(mockCacheDB.delete).not.toHaveBeenCalled();
      expect(mockCacheDB.set).toHaveBeenCalledWith('images/photo.jpg', {
        sha: 'asset-sha',
        size: 1024,
        text: undefined,
        meta: { commitAuthor: author, commitDate: date },
      });
    });

    test('should cache a file without a slug', async () => {
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
      expect(mockCacheDB.set).toHaveBeenCalledWith(
        'config.yml',
        expect.objectContaining({ sha: undefined, text: 'backend:\n  name: github' }),
      );
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

      allEntries.current = existingEntries;

      updateStores({ changes, savedEntries, savedAssets });

      // The function should filter out entries that match saved entry IDs, then add saved entries
      expect(allEntries.current).toEqual([
        // @ts-ignore - Minimal test objects
        { id: 'entry1', slug: 'post-1', subPath: 'post-1', locales: {} }, // Not in savedEntries, so kept
        // @ts-ignore - Minimal test objects
        { id: 'entry3', slug: 'post-3', subPath: 'post-3', locales: {} }, // Not in savedEntries, so kept
        // @ts-ignore - Minimal test objects
        { id: 'entry2', slug: 'updated-post-2', subPath: 'updated-post-2', locales: {} }, // Saved entry (replaces old entry2)
        // @ts-ignore - Minimal test objects
        { id: 'entry4', slug: 'new-post-4', subPath: 'new-post-4', locales: {} }, // New saved entry
      ]);
    });

    test('should replace the entries previously in the rewritten array files', () => {
      const data = { path: 'data/items.json' };
      const other = { path: 'data/other.json' };

      /** @type {any[]} */
      const existingEntries = [
        { id: 'a', arrayIndex: 0, locales: { en: data } },
        { id: 'b', arrayIndex: 1, locales: { en: data } },
        { id: 'c', slug: 'c', locales: { en: { path: 'posts/c.md' } } },
        { id: 'd', arrayIndex: 0, locales: { en: other } },
        // Not an array item, so kept even though the path is the same
        { id: 'e', slug: 'e', locales: { en: data } },
      ];

      /** @type {any[]} */
      const arrayFileEntries = [
        { id: 'a', arrayIndex: 1, locales: { en: data } },
        { id: 'n', arrayIndex: 0, locales: { en: data } },
      ];

      /** @type {any} */
      const savedC = { id: 'c', slug: 'c2', locales: { en: { path: 'posts/c.md' } } };

      allEntries.current = existingEntries;

      updateStores({
        changes: [],
        savedEntries: [arrayFileEntries[0], savedC],
        savedAssets: [],
        arrayFileEntries,
      });

      expect(allEntries.current).toEqual([
        existingEntries[3],
        existingEntries[4],
        savedC,
        arrayFileEntries[0],
        arrayFileEntries[1],
      ]);
      // The saved array entry is not added twice
      expect(allEntries.current.filter(({ id }) => id === 'a')).toHaveLength(1);
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

      allAssets.current = existingAssets;

      updateStores({ changes, savedEntries, savedAssets });

      // Should filter out:
      // - images/photo2.jpg (in savedAssets paths)
      // - images/old-photo.jpg (in movedAssetPaths)
      // - images/to-delete.jpg (in deletedAssetPaths)
      // - images/new-photo4.jpg (in savedAssets paths, but wasn't in existing anyway)
      expect(allAssets.current).toEqual([
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

      allEntries.current = existingEntries;
      allAssets.current = existingAssets;

      updateStores({
        changes: [],
        savedEntries: [],
        savedAssets: [],
      });

      expect(allEntries.current).toEqual(existingEntries); // No changes because no saved entries
      // No changes because no saved assets or changes
      expect(allAssets.current).toEqual(existingAssets);
    });
  });

  describe('saveChanges', () => {
    /** @type {FileChange[]} */
    const simpleChanges = [
      {
        action: /** @type {CommitAction} */ ('create'),
        path: 'posts/a.md',
        slug: 'a',
        data: '# A',
      },
    ];

    /** @type {CommitOptions} */
    const simpleOptions = { commitType: /** @type {CommitType} */ ('create') };

    test('should check the repository for changes before committing', async () => {
      /** @type {string[]} */
      const order = [];

      vi.mocked(checkForRemoteChanges).mockImplementation(async () => {
        order.push('check');

        return undefined;
      });

      mockCommitChanges.mockImplementation(async () => {
        order.push('commit');

        return { sha: 'commit123', date: new Date(), files: {} };
      });

      await saveChanges({ changes: simpleChanges, options: simpleOptions });

      expect(order).toEqual(['check', 'commit']);
    });

    test('should commit anyway when the check fails, reporting the failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('offline');

      vi.mocked(checkForRemoteChanges).mockRejectedValue(error);

      await saveChanges({ changes: simpleChanges, options: simpleOptions });

      expect(mockCommitChanges).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to check the repository for changes.', error);
      consoleSpy.mockRestore();
    });

    test('should hold off further checks while the commit is being made', async () => {
      await saveChanges({ changes: simpleChanges, options: simpleOptions });

      expect(suspendChecksWhile).toHaveBeenCalledTimes(1);

      // The commit was made inside the suspended section
      const [task] = vi.mocked(suspendChecksWhile).mock.calls[0];

      expect(task).toBeInstanceOf(Function);
      expect(mockCommitChanges).toHaveBeenCalledTimes(1);
    });

    test('should combine the changes to a file storing all the entries while checks are held off', async () => {
      /** @type {boolean[]} */
      const suspended = [];
      let inside = false;

      vi.mocked(suspendChecksWhile).mockImplementation(async (task) => {
        inside = true;

        try {
          return await task();
        } finally {
          inside = false;
        }
      });
      vi.mocked(combineArrayFileChanges).mockImplementation(async (changes) => {
        suspended.push(inside);

        return { changes, arrayFileUpdates: [] };
      });

      await saveChanges({ changes: simpleChanges, options: simpleOptions });

      // A check for remote changes would otherwise replace the items the changes are applied to
      expect(suspended).toEqual([true]);
    });

    test('should record the commit as the head the stores reflect on a Git backend', async () => {
      /** @type {any} */ (backend).current = {
        commitChanges: mockCommitChanges,
        fetchLastCommit: vi.fn(),
        repository: { databaseName: 'test-db' },
      };

      await saveChanges({ changes: simpleChanges, options: simpleOptions });

      expect(repositoryHead.current).toBe('commit123');
    });

    test('should leave the head alone on a backend without commits to compare', async () => {
      await saveChanges({ changes: simpleChanges, options: simpleOptions });

      expect(repositoryHead.current).toBe('');
    });

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

    test('should commit the combined changes and use the entries made from the array files', async () => {
      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('update'),
          path: 'data/items.json',
          data: '{}',
          arrayItem: { index: 0 },
        },
      ];

      /** @type {FileChange[]} */
      const combinedChanges = [
        { action: /** @type {CommitAction} */ ('update'), path: 'data/items.json', data: '[]' },
      ];

      /** @type {any[]} */
      const arrayFileUpdates = [{ path: 'data/items.json' }];
      /** @type {any} */
      const arrayEntry = { id: 'a', slug: 'a', locales: { en: { path: 'data/items.json' } } };
      /** @type {any} */
      const otherEntry = { id: 'b', slug: 'b', locales: { en: { path: 'posts/b.md' } } };
      /** @type {any} */
      const savedArrayEntry = { ...arrayEntry, arrayIndex: 0 };

      /** @type {any} */
      const newArrayEntry = {
        id: 'n',
        arrayIndex: 1,
        locales: { en: { path: 'data/items.json' } },
      };

      vi.mocked(combineArrayFileChanges).mockResolvedValue({
        changes: combinedChanges,
        // @ts-ignore - Minimal test objects
        arrayFileUpdates,
      });
      vi.mocked(createArrayFileEntries).mockReturnValue({
        entries: [savedArrayEntry, newArrayEntry],
        savedEntries: new Map([[arrayEntry, savedArrayEntry]]),
      });

      const commitDate = new Date('2023-01-01T12:00:00Z');

      mockCommitChanges.mockResolvedValue({ sha: 'commit123', date: commitDate, files: {} });
      allEntries.current = [];

      /** @type {CommitOptions} */
      const options = { commitType: /** @type {CommitType} */ ('update') };

      const result = await saveChanges({
        changes,
        savingEntries: [arrayEntry, otherEntry],
        options,
      });

      expect(combineArrayFileChanges).toHaveBeenCalledWith(changes);
      expect(mockCommitChanges).toHaveBeenCalledWith(combinedChanges, options);
      expect(createArrayFileEntries).toHaveBeenCalledWith({
        arrayFileUpdates,
        savingEntries: [arrayEntry, otherEntry],
        meta: { commitAuthor: expect.any(Object), commitDate },
      });
      expect(result.savedEntries).toEqual([
        savedArrayEntry,
        { ...otherEntry, commitAuthor: expect.any(Object), commitDate },
      ]);
      expect(result.savedEntries[0]).toBe(savedArrayEntry);
      expect(allEntries.current).toEqual([
        { ...otherEntry, commitAuthor: expect.any(Object), commitDate },
        savedArrayEntry,
        newArrayEntry,
      ]);
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

      const { cacheAssetBlob } = await import('$lib/services/assets/info');
      const createObjectURL = vi.spyOn(URL, 'createObjectURL');

      // @ts-ignore - Type issues in test
      const result = await saveChanges({
        changes,
        savingEntries: [],
        // A moved asset comes with the URL of its previous file, which is replaced
        savingAssets: savingAssets.map((asset) => ({ ...asset, blobURL: 'blob:old' })),
        options,
      });

      expect(result.savedAssets).toHaveLength(1);
      expect(result.savedAssets[0]).toMatchObject({
        path: 'images/photo.jpg',
        name: 'photo.jpg',
        sha: 'file123',
        blobURL: 'blob:http://localhost/display-url',
      });
      // The URL is made for display, so a file like an SVG image can’t run script on the CMS
      // origin, and the saved file is remembered for the asset
      expect(cacheAssetBlob).toHaveBeenCalledExactlyOnceWith(
        result.savedAssets[0],
        expect.any(File),
      );
      expect(createObjectURL).not.toHaveBeenCalled();
    });

    test('should hand a saved SVG image to the display URL helper as it is', async () => {
      const { cacheAssetBlob } = await import('$lib/services/assets/info');
      const svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
      const file = new File([svg], 'diagram.svg', { type: 'image/svg+xml' });

      mockCommitChanges.mockResolvedValue({
        sha: 'commit456',
        date: new Date('2023-01-01T12:00:00Z'),
        files: { 'images/diagram.svg': { sha: 'file123', file } },
      });

      const result = await saveChanges({
        changes: [{ action: 'create', path: 'images/diagram.svg', data: file }],
        // @ts-ignore - Minimal test object
        savingAssets: [{ path: 'images/diagram.svg', name: 'diagram.svg' }],
        options: { commitType: 'create' },
      });

      // The helper gives the asset the URL of a wrapper that can’t run script, and remembers the
      // file itself, so reading the asset gives the file rather than the wrapper
      expect(cacheAssetBlob).toHaveBeenCalledExactlyOnceWith(result.savedAssets[0], file);
    });

    test('should handle asset changes with missing file in commit results', async () => {
      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'images/photo2.jpg',
          data: new File(['fake image data'], 'photo2.jpg'),
        },
      ];

      /** @type {Asset[]} */
      const savingAssets = [
        // @ts-ignore - Minimal test object
        {
          path: 'images/photo2.jpg',
          name: 'photo2.jpg',
          size: 2048,
          sha: 'test-sha-2',
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
        sha: 'commit789',
        date: new Date('2023-01-01T12:00:00Z'),
        files: {
          // No entry for 'images/photo2.jpg' - file is undefined
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
        path: 'images/photo2.jpg',
        name: 'photo2.jpg',
        sha: undefined,
        blobURL: undefined,
      });
    });

    test('should handle asset changes with sha but no file in commit results', async () => {
      /** @type {FileChange[]} */
      const changes = [
        {
          action: /** @type {CommitAction} */ ('create'),
          path: 'images/photo3.jpg',
          data: new File(['fake image data'], 'photo3.jpg'),
        },
      ];

      /** @type {Asset[]} */
      const savingAssets = [
        // @ts-ignore - Minimal test object
        {
          path: 'images/photo3.jpg',
          name: 'photo3.jpg',
          size: 3072,
          sha: 'test-sha-3',
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
        sha: 'commit999',
        date: new Date('2023-01-01T12:00:00Z'),
        files: {
          'images/photo3.jpg': {
            sha: 'new-file-sha',
            // file property is missing/undefined
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
        path: 'images/photo3.jpg',
        name: 'photo3.jpg',
        sha: 'new-file-sha',
        blobURL: undefined,
      });
      expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    test('should handle missing user information', async () => {
      // Setup user with empty name/email
      mockUserState.account = {
        name: '', // Empty name
        email: '', // Empty email
        id: 'user123',
        login: 'testuser',
      };

      /** @type {any} */ (backend).current = {
        commitChanges: mockCommitChanges,
        repository: { databaseName: 'test-db' },
      };

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

      const entries = allEntries.current;
      const assets = allAssets.current;

      // @ts-ignore - Type issues in test
      await saveChanges({
        changes,
        savingEntries: [],
        savingAssets: [],
        options,
      });

      // The state is replaced with new arrays
      expect(allEntries.current).not.toBe(entries);
      expect(allAssets.current).not.toBe(assets);
    });

    test('should log debug information when devMode is enabled', async () => {
      // Mock console.debug to track debug calls
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      mockPrefs.devModeEnabled = true;

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
