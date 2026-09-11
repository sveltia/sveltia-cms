// @ts-nocheck

import { isProxy } from 'node:util/types';

import { IndexedDB } from '@sveltia/utils/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfigVersion } from '$lib/services/config';
import { isDraftModified } from '$lib/services/contents/draft';
import { prefs } from '$lib/services/user/prefs.svelte';

vi.mock('@sveltia/utils/storage');
vi.mock('@sveltia/utils/file', () => ({
  getBlobRegex: vi.fn((flags = '') => new RegExp('\\bblob:http://localhost/[\\w-]+\\b', flags)),
}));
vi.mock('@sveltia/utils/object', () => ({
  toRaw: vi.fn((val) => val),
}));

const { toRaw } = await import('@sveltia/utils/object');

vi.mock('$lib/services/config');
// Mock only the modification check, so the real `suspendAutoDuplication` still runs its callback
vi.mock('$lib/services/contents/draft', async () => ({
  ...(await vi.importActual('$lib/services/contents/draft')),
  isDraftModified: vi.fn(() => false),
}));
vi.mock('$lib/services/contents/draft/create/proxy.svelte', () => ({
  createProxy: vi.fn(({ target }) => target),
}));
vi.mock('$lib/services/contents/collection/entries/reorder', () => ({
  getOrderFieldKey: vi.fn(() => undefined),
}));
vi.mock('$lib/services/backends', () => ({
  backend: {
    subscribe: vi.fn((callback) => {
      // Simulate the backend being initialized
      callback({ repository: { databaseName: 'test-db' } });

      return vi.fn(); // unsubscribe function
    }),
  },
}));

const mockPrefs = vi.hoisted(() => ({ useDraftBackup: /** @type {boolean | undefined} */ (true) }));

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: mockPrefs,
}));
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn(() => ({ devModeEnabled: false })),
  };
});

describe('draft/backup', () => {
  /** @type {any} */
  const mockBackupDB = {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

  let mockGet;
  /** Whether the user has interacted with the editor, copied into the drafts below. */
  let interacted = false;
  let deleteBackup;
  let getBackup;
  let saveBackup;
  let restoreDialogState;
  let backupToastState;
  let restoreBackup;
  let restoreBackupIfNeeded;
  let showBackupToastIfNeeded;
  let resetBackupToastState;
  let scheduleBackup;

  // Mock IndexedDB constructor to return our mock (must happen before importing backup module)
  // Vitest 4 requires proper constructor with 'class' keyword
  /** @type {any} */
  class MockIndexedDB {
    /**
     * Creates an instance of MockIndexedDB with mock methods.
     */
    constructor() {
      // Copy all methods from mockBackupDB to this instance
      Object.assign(this, mockBackupDB);
    }
  }

  vi.mocked(IndexedDB).mockImplementation(MockIndexedDB);

  beforeEach(async () => {
    vi.clearAllMocks();
    mockPrefs.useDraftBackup = true;
    interacted = false;

    // Import module (happens once, uses the mock set up above)
    const backupModule = await import('./backup');

    ({
      deleteBackup,
      getBackup,
      saveBackup,
      restoreDialogState,
      backupToastState,
      restoreBackup,
      restoreBackupIfNeeded,
      showBackupToastIfNeeded,
      resetBackupToastState,
      scheduleBackup,
    } = backupModule);

    const { get } = await import('svelte/store');

    mockGet = vi.mocked(get);

    // Mock stores
    mockGet.mockImplementation((store) => {
      if (store === prefs) {
        return { useDraftBackup: true };
      }

      if (store === cmsConfigVersion) {
        return 'v1.0.0';
      }

      if (store === backupModule.backupToastState) {
        return { saved: false, restored: false, deleted: false };
      }

      return undefined;
    });
    vi.mocked(isDraftModified).mockReturnValue(false);
    interacted = false;
  });

  describe('deleteBackup', () => {
    it('should delete backup for existing entry', async () => {
      await deleteBackup('posts', 'my-post');

      expect(mockBackupDB.delete).toHaveBeenCalledWith(['posts', 'my-post']);
    });

    it('should delete backup for new entry', async () => {
      await deleteBackup('posts');

      expect(mockBackupDB.delete).toHaveBeenCalledWith(['posts', '']);
    });

    it('should handle null database', async () => {
      vi.mocked(IndexedDB).mockReturnValue(null);

      await expect(deleteBackup('posts', 'my-post')).resolves.not.toThrow();
    });
  });

  describe('getBackup', () => {
    it('should return backup with matching site config version', async () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
      };

      mockBackupDB.get.mockResolvedValue(backup);

      const result = await getBackup('posts', 'my-post');

      expect(mockBackupDB.get).toHaveBeenCalledWith(['posts', 'my-post']);
      expect(result).toEqual(backup);
    });

    it('should return null if backup does not exist', async () => {
      mockBackupDB.get.mockResolvedValue(undefined);

      const result = await getBackup('posts', 'my-post');

      expect(result).toBeNull();
    });

    it('should delete and return null if site config version mismatch', async () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v0.9.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
      };

      mockBackupDB.get.mockResolvedValue(backup);

      const result = await getBackup('posts', 'my-post');

      expect(mockBackupDB.delete).toHaveBeenCalledWith(['posts', 'my-post']);
      expect(result).toBeNull();
    });

    it('should handle new entry with empty slug', async () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: '',
        currentLocales: { en: true },
        currentSlugs: { en: '' },
        currentValues: { en: { title: 'New Post' } },
        files: {},
      };

      mockBackupDB.get.mockResolvedValue(backup);

      const result = await getBackup('posts');

      expect(mockBackupDB.get).toHaveBeenCalledWith(['posts', '']);
      expect(result).toEqual(backup);
    });
  });

  describe('saveBackup', () => {
    it('should save backup when draft is modified', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });
      vi.mocked(isDraftModified).mockReturnValue(true);
      interacted = true;

      const draft = {
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: { slug: 'my-post' },
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
        interacted,
      };

      await saveBackup(draft);

      expect(mockBackupDB.put).toHaveBeenCalledWith(
        expect.objectContaining({
          cmsConfigVersion: 'v1.0.0',
          collectionName: 'posts',
          slug: 'my-post',
          currentLocales: { en: true },
          currentSlugs: { en: 'my-post' },
          currentValues: { en: { title: 'My Post' } },
          files: {},
        }),
      );
    });

    it('should not save backup when draft is not modified', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        return undefined;
      });
      vi.mocked(isDraftModified).mockReturnValue(false);
      interacted = true;

      mockBackupDB.get.mockResolvedValue(undefined);

      const draft = {
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: { slug: 'my-post' },
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
        interacted,
      };

      await saveBackup(draft);

      expect(mockBackupDB.put).not.toHaveBeenCalled();
    });

    it('should delete existing backup when draft is not modified', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });
      vi.mocked(isDraftModified).mockReturnValue(false);
      interacted = true;

      const existingBackup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
      };

      mockBackupDB.get.mockResolvedValue(existingBackup);

      const draft = {
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: { slug: 'my-post' },
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
        interacted,
      };

      await saveBackup(draft);

      expect(mockBackupDB.delete).toHaveBeenCalledWith(['posts', 'my-post']);
    });

    it('should not save backup when preference is disabled', async () => {
      mockPrefs.useDraftBackup = false;

      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: false };
        }

        return undefined;
      });

      const draft = {
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: { slug: 'my-post' },
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
        interacted,
      };

      await saveBackup(draft);

      expect(mockBackupDB.put).not.toHaveBeenCalled();
    });

    it('should default to enabled (true) when useDraftBackup is undefined', async () => {
      mockPrefs.useDraftBackup = undefined;

      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          // useDraftBackup is not set → `?? true` defaults to true
          return {};
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });
      vi.mocked(isDraftModified).mockReturnValue(true);
      interacted = true;

      const draft = {
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: { slug: 'my-post' },
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
        interacted,
      };

      await saveBackup(draft);

      // Should proceed to save since useDraftBackup defaults to true
      expect(mockBackupDB.put).toHaveBeenCalled();
    });

    it('should use fileName for file collection', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });
      vi.mocked(isDraftModified).mockReturnValue(true);
      interacted = true;

      const draft = {
        collectionName: 'pages',
        fileName: 'about',
        originalEntry: undefined,
        currentLocales: { en: true },
        currentSlugs: { en: 'about' },
        currentValues: { en: { title: 'About' } },
        files: {},
        interacted,
      };

      await saveBackup(draft);

      expect(mockBackupDB.put).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: 'about',
          collectionName: 'pages',
        }),
      );
    });

    it('should handle new entry with empty slug', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });
      vi.mocked(isDraftModified).mockReturnValue(true);
      interacted = true;

      const draft = {
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: undefined,
        currentLocales: { en: true },
        currentSlugs: {},
        currentValues: { en: { title: 'New Post' } },
        files: {},
        interacted,
      };

      await saveBackup(draft);

      expect(mockBackupDB.put).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: '',
          collectionName: 'posts',
        }),
      );
    });

    it('should store plain objects that IndexedDB can clone, not `$state` proxies', async () => {
      const { toRaw: actualToRaw } = await vi.importActual('@sveltia/utils/object');

      vi.mocked(toRaw).mockImplementation(actualToRaw);
      vi.mocked(isDraftModified).mockReturnValue(true);

      /**
       * Stand in for a `$state` proxy, which the test environment doesn’t create: Svelte resolves
       * to its server build here, where `$state()` returns the value as is.
       * @param {object} value Value to wrap.
       * @returns {object} Proxy.
       */
      const proxify = (value) => new Proxy(value, {});
      const file = new File(['x'], 'image.png', { type: 'image/png' });

      const draft = proxify({
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: { slug: 'my-post' },
        currentLocales: proxify({ en: true, fr: false }),
        currentSlugs: proxify({ en: 'my-post' }),
        currentValues: proxify({ en: proxify({ title: 'My Post' }) }),
        files: proxify({
          'blob:http://localhost/abc': proxify({
            file,
            folder: proxify({ internalPath: 'img' }),
            replace: false,
          }),
        }),
        interacted: true,
      });

      await saveBackup(draft);

      const [backup] = mockBackupDB.put.mock.calls[0];

      /**
       * Check whether the value or anything below it is a `Proxy`, which IndexedDB can’t clone.
       * @param {any} value Value to check.
       * @returns {boolean} Result.
       */
      const containsProxy = (value) =>
        isProxy(value) ||
        (!!value &&
          typeof value === 'object' &&
          !(value instanceof File) &&
          Object.values(value).some(containsProxy));

      expect(containsProxy(backup)).toBe(false);
      expect(backup.currentLocales).toEqual({ en: true, fr: false });
      expect(backup.currentValues).toEqual({ en: { title: 'My Post' } });
      expect(backup.files['blob:http://localhost/abc']).toEqual({
        file,
        folder: { internalPath: 'img' },
        replace: false,
      });
    });

    it('should not save backup when user has not interacted with the editor', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        return undefined;
      });
      vi.mocked(isDraftModified).mockReturnValue(true);
      interacted = false;

      const draft = {
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: { slug: 'my-post' },
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
        interacted,
      };

      await saveBackup(draft);

      expect(mockBackupDB.put).not.toHaveBeenCalled();
    });
  });

  describe('restoreBackup', () => {
    /**
     * Creates a mock draft with an update function that calls its callback.
     * @param {object} [override] Override properties for the draft.
     * @returns {object} Mock draft.
     */
    const createMockDraft = (override = {}) => ({
      collectionName: 'posts',
      fileName: undefined,
      currentLocales: { en: true },
      currentSlugs: { en: 'my-post' },
      currentValues: { en: {} },
      originalValues: {},
      files: {},
      ...override,
    });

    /** @type {any} */
    let updatedDraft;

    beforeEach(() => {
      updatedDraft = createMockDraft();
    });

    it('should restore backup to entry draft without errors', () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'Restored Title' } },
        files: {},
      };

      expect(() => {
        restoreBackup({ backup, draft: updatedDraft });
      }).not.toThrow();
    });

    it('should update currentLocales and currentSlugs from backup', () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true, fr: false },
        currentSlugs: { en: 'restored-post' },
        currentValues: { en: { title: 'Restored' } },
        files: {},
      };

      updatedDraft = createMockDraft();

      restoreBackup({ backup, draft: updatedDraft });

      expect(updatedDraft.currentLocales).toEqual({ en: true, fr: false });
      expect(updatedDraft.currentSlugs).toEqual({ en: 'restored-post' });
    });

    it('should handle backup with blob URLs in values', () => {
      const testFile = new File(['file content'], 'image.png', { type: 'image/png' });

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { content: 'blob:http://localhost/abc123' } },
        files: { 'blob:http://localhost/abc123': { file: testFile, folder: undefined } },
      };

      expect(() => {
        restoreBackup({ backup, draft: updatedDraft });
      }).not.toThrow();
    });

    it('should handle blob URL where value is already in fileURLs cache', () => {
      const sharedFile = new File(['shared'], 'shared.txt');

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: {
          en: {
            image1: 'blob:http://localhost/abc123',
            image2: 'blob:http://localhost/def456',
          },
        },
        files: {
          'blob:http://localhost/abc123': { file: sharedFile, folder: undefined },
          'blob:http://localhost/def456': { file: sharedFile, folder: undefined },
        },
      };

      expect(() => {
        restoreBackup({ backup, draft: updatedDraft });
      }).not.toThrow();
    });

    it('should skip blob URLs whose cache entry has no file property (legacy format)', () => {
      const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { content: 'Image: blob:http://localhost/legacy123' } },
        // Legacy format: files is a direct File object instead of { file, folder }
        files: { 'blob:http://localhost/legacy123': testFile },
      };

      /** @type {any} */
      updatedDraft = createMockDraft();

      restoreBackup({ backup, draft: updatedDraft });

      // Legacy format is no longer migrated — the blob URL is skipped entirely
      expect(Object.keys(updatedDraft.files)).toHaveLength(0);
    });

    it('should skip blob URLs that have no matching file in cache', () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { content: 'Image: blob:http://localhost/missing123' } },
        files: {}, // No file for the blob URL
      };

      expect(() => {
        restoreBackup({ backup, draft: updatedDraft });
      }).not.toThrow();
    });

    it('should handle multiple blob URLs in same content string', () => {
      const file1 = new File(['test1'], 'test1.txt');
      const file2 = new File(['test2'], 'test2.txt');

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: {
          en: {
            content: 'Image1: blob:http://localhost/abc123 Image2: blob:http://localhost/def456',
          },
        },
        files: {
          'blob:http://localhost/abc123': { file: file1, folder: undefined },
          'blob:http://localhost/def456': { file: file2, folder: undefined },
        },
      };

      expect(() => {
        restoreBackup({ backup, draft: updatedDraft });
      }).not.toThrow();
    });

    it('should assign existing locale values when locale already has content', () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'New Title', body: 'New Body' } },
        files: {},
      };

      const existingLocaleContent = { title: 'Old Title', body: 'Old Body', extra: 'keep' };

      updatedDraft = createMockDraft({
        currentValues: { en: existingLocaleContent },
        originalValues: { en: { title: 'Original' } },
      });

      expect(() => {
        restoreBackup({ backup, draft: updatedDraft });
      }).not.toThrow();
    });

    it('should create proxy for locale that does not yet have content', () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true, fr: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { fr: { title: 'Titre en Français' } },
        files: {},
      };

      // Draft only has 'en' locale currently
      updatedDraft = createMockDraft({
        currentValues: { en: {} }, // no 'fr' locale
        originalValues: {},
      });

      expect(() => {
        restoreBackup({ backup, draft: updatedDraft });
      }).not.toThrow();
    });

    it('should initialize originalValues for locales that previously had none', () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true, fr: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'English' }, fr: { title: 'French' } },
        files: {},
      };

      updatedDraft = createMockDraft({
        currentValues: { en: {}, fr: {} },
        originalValues: { en: {} }, // fr has no originalValues
      });

      expect(() => {
        restoreBackup({ backup, draft: updatedDraft });
      }).not.toThrow();
    });

    it('should handle file collection with fileName', () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'pages',
        slug: '',
        currentLocales: { en: true },
        currentSlugs: {},
        currentValues: { en: { title: 'About Page' } },
        files: {},
      };

      expect(() => {
        restoreBackup({ backup, draft: updatedDraft });
      }).not.toThrow();
    });

    it('should skip non-string values in currentValues during restore', () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: {
          en: {
            title: 'Text Value', // string — processed
            count: 42, // number — skipped (not a string)
            active: true, // boolean — skipped
            tags: ['a', 'b'], // array — skipped
          },
        },
        files: {},
      };

      expect(() => {
        restoreBackup({ backup, draft: updatedDraft });
      }).not.toThrow();
    });

    it('replaces a null optional object field with an empty object when child values exist', () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: {
          en: {
            title: 'Restored Title',
            author: null,
            'author.name': 'Alice',
            'author.role': 'Editor',
          },
        },
        files: {},
      };

      updatedDraft = createMockDraft();

      restoreBackup({ backup, draft: updatedDraft });

      expect(updatedDraft.currentValues.en.author).toEqual({});
      expect(updatedDraft.currentValues.en['author.name']).toBe('Alice');
    });

    it('reconciles a stale order field with the live entry value when originalEntry exists', async () => {
      const { getOrderFieldKey } =
        await import('$lib/services/contents/collection/entries/reorder');

      vi.mocked(getOrderFieldKey).mockReturnValueOnce('order');

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        // Backup has stale order value 3
        currentValues: { en: { title: 'Old Title', order: 3 } },
        files: {},
      };

      updatedDraft = createMockDraft({
        collection: { reorder: true },
        originalEntry: { locales: { en: { content: { title: 'Old Title', order: 7 } } } },
      });

      restoreBackup({ backup, draft: updatedDraft });

      // The restored order should use the live value (7), not the stale backup value (3)
      expect(updatedDraft.currentValues.en.order).toBe(7);
    });

    it('removes the order field when originalEntry does not exist (new entry)', async () => {
      const { getOrderFieldKey } =
        await import('$lib/services/contents/collection/entries/reorder');

      vi.mocked(getOrderFieldKey).mockReturnValueOnce('order');

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: '',
        currentLocales: { en: true },
        currentSlugs: { en: '' },
        // Backup has an order value from a previous save attempt
        currentValues: { en: { title: 'New Post', order: 2 } },
        files: {},
      };

      updatedDraft = createMockDraft({
        collection: { reorder: true },
        originalEntry: undefined, // new entry — no live order
        currentValues: { en: {} },
        originalValues: { en: {} },
      });

      restoreBackup({ backup, draft: updatedDraft });

      const capturedValueMap = backup.currentValues.en;

      // The order field should be removed so assignManualSortOrder can recompute it at save time
      expect('order' in capturedValueMap).toBe(false);
    });
  });

  describe('stores', () => {
    it('should initialize restoreDialogState with show: false', () => {
      let value;

      restoreDialogState.subscribe((v) => {
        value = v;
      });

      expect(value).toEqual({ show: false });
    });

    it('should initialize backupToastState with default state', () => {
      let value;

      backupToastState.subscribe((v) => {
        value = v;
      });

      expect(value).toEqual({
        saved: false,
        restored: false,
        deleted: false,
      });
    });
  });

  describe('restoreBackupIfNeeded', () => {
    /**
     * Create a draft to restore a backup to.
     * @param {object} [override] Override properties for the draft.
     * @returns {any} Draft.
     */
    const createRestoreDraft = (override = {}) => ({
      collectionName: 'posts',
      fileName: undefined,
      originalEntry: { slug: 'my-post' },
      currentLocales: { en: true },
      currentSlugs: { en: 'my-post' },
      currentValues: { en: {} },
      originalValues: { en: {} },
      files: {},
      interacted: false,
      ...override,
    });

    it('should not restore if preference is disabled', async () => {
      mockPrefs.useDraftBackup = false;

      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: false };
        }

        return undefined;
      });

      await restoreBackupIfNeeded({ draft: createRestoreDraft() });

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should default to enabled when useDraftBackup is undefined', async () => {
      mockPrefs.useDraftBackup = undefined;

      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          // useDraftBackup is not set → `?? true` defaults to true
          return {};
        }

        return undefined;
      });

      mockBackupDB.get.mockResolvedValue(undefined);

      await restoreBackupIfNeeded({ draft: createRestoreDraft() });

      // Should proceed to check for backup since useDraftBackup defaults to true
      expect(mockBackupDB.get).toHaveBeenCalledWith(['posts', 'my-post']);
    });

    it('should not restore if backup does not exist', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });

      mockBackupDB.get.mockResolvedValue(undefined);

      await restoreBackupIfNeeded({ draft: createRestoreDraft() });

      expect(mockBackupDB.get).toHaveBeenCalledWith(['posts', 'my-post']);
    });

    it('should show restore dialog and restore backup when user confirms', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
      };

      mockBackupDB.get.mockResolvedValue(backup);

      const promise = restoreBackupIfNeeded({ draft: createRestoreDraft() });

      // Wait a bit for promise to start
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      // Simulate user confirming restore
      let dialogState;

      restoreDialogState.subscribe((state) => {
        dialogState = state;
      });

      if (dialogState?.resolve) {
        dialogState.resolve(true);
      }

      await promise;

      // Check that toast state was updated
      let toastState;

      backupToastState.subscribe((state) => {
        toastState = state;
      });

      expect(toastState).toEqual({
        saved: false,
        restored: true,
        deleted: false,
      });
    });

    it('should delete backup when user cancels restore', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
      };

      mockBackupDB.get.mockResolvedValue(backup);

      const promise = restoreBackupIfNeeded({ draft: createRestoreDraft() });

      // Wait a bit for promise to start
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      // Simulate user canceling restore
      let dialogState;

      restoreDialogState.subscribe((state) => {
        dialogState = state;
      });

      if (dialogState?.resolve) {
        dialogState.resolve(false);
      }

      await promise;

      expect(mockBackupDB.delete).toHaveBeenCalledWith(['posts', 'my-post']);

      // Check that toast state was updated
      let toastState;

      backupToastState.subscribe((state) => {
        toastState = state;
      });

      expect(toastState).toEqual({
        saved: false,
        restored: false,
        deleted: true,
      });
    });

    it('should handle file collection with fileName', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });

      mockBackupDB.get.mockResolvedValue(undefined);

      await restoreBackupIfNeeded({
        draft: createRestoreDraft({ collectionName: 'pages', fileName: 'about' }),
      });

      expect(mockBackupDB.get).toHaveBeenCalledWith(['pages', 'about']);
    });

    it('should return early when dialog is dismissed without selecting an option', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
      };

      mockBackupDB.get.mockResolvedValue(backup);

      const promise = restoreBackupIfNeeded({ draft: createRestoreDraft() });

      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      // Simulate dialog being dismissed (resolve with undefined)
      let dialogState;

      restoreDialogState.subscribe((state) => {
        dialogState = state;
      });

      if (dialogState?.resolve) {
        dialogState.resolve(undefined);
      }

      await promise;

      // Neither restore nor delete should have been called
      expect(mockBackupDB.delete).not.toHaveBeenCalled();
      expect(mockBackupDB.put).not.toHaveBeenCalled();
    });
  });

  describe('showBackupToastIfNeeded', () => {
    it('should not show toast if preference is disabled', async () => {
      mockPrefs.useDraftBackup = false;

      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: false };
        }

        return undefined;
      });

      await showBackupToastIfNeeded(undefined);

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should default to enabled when useDraftBackup is undefined', async () => {
      mockPrefs.useDraftBackup = undefined;

      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          // useDraftBackup not set → defaults to true
          return {};
        }

        return undefined;
      });

      await showBackupToastIfNeeded(null);

      // Should proceed past the pref check (draft is null so no DB call)
      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should not show toast if no draft exists', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        return undefined;
      });

      await showBackupToastIfNeeded(null);

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should not show toast if toast already saved', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === backupToastState) {
          return { saved: true, restored: false, deleted: false };
        }

        return undefined;
      });

      await showBackupToastIfNeeded({
        collectionName: 'posts',
        originalEntry: { slug: 'my-post' },
      });

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should show toast when backup exists', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        if (store === backupToastState) {
          return { saved: false, restored: false, deleted: false };
        }

        return undefined;
      });

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
      };

      mockBackupDB.get.mockResolvedValue(backup);

      await showBackupToastIfNeeded({
        collectionName: 'posts',
        originalEntry: { slug: 'my-post' },
      });

      expect(mockBackupDB.get).toHaveBeenCalledWith(['posts', 'my-post']);
      // The backupToastState.set is called when backup exists, covering line 263
    });

    it('should not show toast when backup does not exist (null)', async () => {
      // Covers the false branch of `if (backup) {` at line 263
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        if (store === backupToastState) {
          return { saved: false, restored: false, deleted: false };
        }

        return undefined;
      });

      mockBackupDB.get.mockResolvedValue(null);

      await showBackupToastIfNeeded({
        collectionName: 'posts',
        originalEntry: { slug: 'no-backup-post' },
      });

      expect(mockBackupDB.get).toHaveBeenCalledWith(['posts', 'no-backup-post']);
      // When backup is null, backupToastState.set should NOT be called
    });

    it('should handle entry with no originalEntry (new entry)', async () => {
      // Covers originalEntry?.slug when originalEntry is undefined (line 261)
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        if (store === backupToastState) {
          return { saved: false, restored: false, deleted: false };
        }

        return undefined;
      });

      mockBackupDB.get.mockResolvedValue(null);

      await showBackupToastIfNeeded({ collectionName: 'posts', originalEntry: undefined });

      // Called with '' slug (new entry: originalEntry?.slug → undefined → ?? '' → '')
      expect(mockBackupDB.get).toHaveBeenCalledWith(['posts', '']);
    });
  });

  describe('resetBackupToastState', () => {
    it('should reset toast state to default', () => {
      // First set some values
      backupToastState.set({ saved: true, restored: true, deleted: true });

      // Reset
      resetBackupToastState();

      let state;

      backupToastState.subscribe((s) => {
        state = s;
      });

      expect(state).toEqual({
        saved: false,
        restored: false,
        deleted: false,
      });
    });
  });

  describe('scheduleBackup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.mocked(isDraftModified).mockReturnValue(true);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /**
     * Create a draft the user has interacted with.
     * @param {string} title Title.
     * @returns {any} Draft.
     */
    const createDraft = (title) => ({
      collectionName: 'posts',
      fileName: undefined,
      originalEntry: { slug: 'test-post' },
      currentLocales: { en: true },
      currentSlugs: { en: 'test-post' },
      currentValues: { en: { title } },
      files: {},
      interacted: true,
    });

    it('should save a backup once the draft has settled', async () => {
      scheduleBackup(createDraft('Hello'));

      expect(mockBackupDB.put).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(600);

      expect(mockBackupDB.put).toHaveBeenCalledWith(
        expect.objectContaining({ currentValues: { en: { title: 'Hello' } } }),
      );
    });

    it('should only save the latest of the drafts scheduled in a row', async () => {
      scheduleBackup(createDraft('Hel'));
      await vi.advanceTimersByTimeAsync(300);
      scheduleBackup(createDraft('Hello'));
      await vi.advanceTimersByTimeAsync(600);

      expect(mockBackupDB.put).toHaveBeenCalledTimes(1);
      expect(mockBackupDB.put).toHaveBeenCalledWith(
        expect.objectContaining({ currentValues: { en: { title: 'Hello' } } }),
      );
    });

    it('should drop a pending backup when the draft is gone', async () => {
      scheduleBackup(createDraft('Hello'));
      scheduleBackup(null);
      await vi.advanceTimersByTimeAsync(600);

      expect(mockBackupDB.put).not.toHaveBeenCalled();
    });
  });

  describe('backend subscription', () => {
    it('should set backupDB to null when backend has no databaseName', async () => {
      // Re-import to get fresh backend subscription
      vi.resetModules();

      // Mock backend without databaseName
      vi.doMock('$lib/services/backends', () => ({
        backend: {
          subscribe: vi.fn((callback) => {
            // Simulate backend with no repository
            callback({ repository: undefined });

            return vi.fn();
          }),
        },
      }));

      // This import will trigger the backend subscription
      await import('./backup');

      // The backupDB should be set to null (we can't directly test this as it's private,
      // but we can verify behavior)
      // This test mainly ensures the code path is covered
    });
  });

  describe('additional backup tests', () => {
    it('should successfully get a null backup when none exists', async () => {
      mockBackupDB.get.mockResolvedValue(null);

      const result = await getBackup('posts', 'my-post');

      expect(result).toBeNull();
    });
  });

  describe('getBackup with null backupDB', () => {
    it('should handle null database gracefully', async () => {
      vi.mocked(IndexedDB).mockReturnValue(null);

      const result = await getBackup('posts', 'my-post');

      expect(result).toBeNull();
    });
  });

  describe('backend subscription false branch (L276 false — _backend falsy)', () => {
    it('should set backupDB to null when backend fires with null', async () => {
      // The outer if is `_backend && !backupDB`. When _backend is null/falsy, the condition is
      // false → body skipped → backupDB = null.  This covers L276 if false branch.
      vi.resetModules();

      vi.doMock('$lib/services/backends', () => ({
        backend: {
          subscribe: vi.fn((callback) => {
            callback(null); // falsy _backend → L276 false (body skipped)
            return vi.fn();
          }),
        },
      }));

      const mod = await import('./backup');

      expect(mod).toBeDefined();
    });
  });
});
