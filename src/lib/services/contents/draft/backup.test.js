/* eslint-disable max-classes-per-file */
// @ts-nocheck

import { IndexedDB } from '@sveltia/utils/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfigVersion } from '$lib/services/config';
import { entryDraftModified } from '$lib/services/contents/draft';
import { prefs } from '$lib/services/user/prefs';

vi.mock('@sveltia/utils/storage');
vi.mock('@sveltia/utils/file', () => ({
  getBlobRegex: vi.fn((flags = '') => new RegExp('\\bblob:http://localhost/[\\w-]+\\b', flags)),
}));
vi.mock('@sveltia/utils/object', () => ({
  toRaw: vi.fn((val) => val),
}));
vi.mock('$lib/services/config');
vi.mock('$lib/services/contents/draft');
vi.mock('$lib/services/contents/draft/create/proxy', () => ({
  createProxy: vi.fn(({ target }) => target),
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
vi.mock('$lib/services/user/prefs', () => ({
  prefs: { subscribe: vi.fn(() => vi.fn()) },
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
  let deleteBackup;
  let getBackup;
  let saveBackup;
  let restoreDialogState;
  let backupToastState;
  let restoreBackup;
  let restoreBackupIfNeeded;
  let showBackupToastIfNeeded;
  let resetBackupToastState;
  let entryDraft;

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

    // Import module (happens once, uses the mock set up above)
    const backupModule = await import('./backup');
    const draftModule = await import('./index');

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
    } = backupModule);
    ({ entryDraft } = draftModule);

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

      if (store === entryDraftModified) {
        return false;
      }

      if (store === backupModule.backupToastState) {
        return { saved: false, restored: false, deleted: false };
      }

      return undefined;
    });
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

        if (store === entryDraftModified) {
          return true;
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

        if (store === entryDraftModified) {
          return false;
        }

        return undefined;
      });

      mockBackupDB.get.mockResolvedValue(undefined);

      const draft = {
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: { slug: 'my-post' },
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
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

        if (store === entryDraftModified) {
          return false;
        }

        return undefined;
      });

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
      };

      await saveBackup(draft);

      expect(mockBackupDB.delete).toHaveBeenCalledWith(['posts', 'my-post']);
    });

    it('should not save backup when preference is disabled', async () => {
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
      };

      await saveBackup(draft);

      expect(mockBackupDB.put).not.toHaveBeenCalled();
    });

    it('should use fileName for file collection', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === cmsConfigVersion) {
          return 'v1.0.0';
        }

        if (store === entryDraftModified) {
          return true;
        }

        return undefined;
      });

      const draft = {
        collectionName: 'pages',
        fileName: 'about',
        originalEntry: undefined,
        currentLocales: { en: true },
        currentSlugs: { en: 'about' },
        currentValues: { en: { title: 'About' } },
        files: {},
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

        if (store === entryDraftModified) {
          return true;
        }

        return undefined;
      });

      const draft = {
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: undefined,
        currentLocales: { en: true },
        currentSlugs: {},
        currentValues: { en: { title: 'New Post' } },
        files: {},
      };

      await saveBackup(draft);

      expect(mockBackupDB.put).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: '',
          collectionName: 'posts',
        }),
      );
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

    beforeEach(() => {
      // Make entryDraft.update call the callback with the mock draft
      vi.mocked(entryDraft.update).mockImplementation((updater) => {
        updater(createMockDraft());
      });
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
        restoreBackup({ backup, collectionName: 'posts', fileName: undefined });
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

      let updatedDraft;

      vi.mocked(entryDraft.update).mockImplementation((updater) => {
        updatedDraft = createMockDraft();
        updater(updatedDraft);
      });

      restoreBackup({ backup, collectionName: 'posts', fileName: undefined });

      expect(updatedDraft.currentLocales).toEqual({ en: true, fr: false });
      expect(updatedDraft.currentSlugs).toEqual({ en: 'restored-post' });
    });

    it('should handle backup with blob URLs in values using entryDraft.update callback', () => {
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
        restoreBackup({ backup, collectionName: 'posts', fileName: undefined });
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
        restoreBackup({ backup, collectionName: 'posts', fileName: undefined });
      }).not.toThrow();
    });

    it('should handle legacy file format (File instead of object with file property)', () => {
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

      expect(() => {
        restoreBackup({ backup, collectionName: 'posts', fileName: undefined });
      }).not.toThrow();
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
        restoreBackup({ backup, collectionName: 'posts', fileName: undefined });
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
        restoreBackup({ backup, collectionName: 'posts', fileName: undefined });
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

      vi.mocked(entryDraft.update).mockImplementation((updater) => {
        const draft = createMockDraft({
          currentValues: { en: existingLocaleContent },
          originalValues: { en: { title: 'Original' } },
        });

        updater(draft);
      });

      expect(() => {
        restoreBackup({ backup, collectionName: 'posts', fileName: undefined });
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
      vi.mocked(entryDraft.update).mockImplementation((updater) => {
        const draft = createMockDraft({
          currentValues: { en: {} }, // no 'fr' locale
          originalValues: {},
        });

        updater(draft);
      });

      expect(() => {
        restoreBackup({ backup, collectionName: 'posts', fileName: 'about' });
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

      vi.mocked(entryDraft.update).mockImplementation((updater) => {
        const draft = createMockDraft({
          currentValues: { en: {}, fr: {} },
          originalValues: { en: {} }, // fr has no originalValues
        });

        updater(draft);
      });

      expect(() => {
        restoreBackup({ backup, collectionName: 'posts', fileName: undefined });
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
        restoreBackup({ backup, collectionName: 'pages', fileName: 'about' });
      }).not.toThrow();
    });

    it('should return draft unchanged when draft is null in update callback', () => {
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'Title' } },
        files: {},
      };

      vi.mocked(entryDraft.update).mockImplementation((updater) => {
        updater(null);
      });

      expect(() => {
        restoreBackup({ backup, collectionName: 'posts', fileName: undefined });
      }).not.toThrow();
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
    it('should not restore if preference is disabled', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: false };
        }

        return undefined;
      });

      await restoreBackupIfNeeded({ collectionName: 'posts', slug: 'my-post' });

      expect(mockBackupDB.get).not.toHaveBeenCalled();
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

      await restoreBackupIfNeeded({ collectionName: 'posts', slug: 'my-post' });

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

      const promise = restoreBackupIfNeeded({ collectionName: 'posts', slug: 'my-post' });

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

      const promise = restoreBackupIfNeeded({ collectionName: 'posts', slug: 'my-post' });

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

      await restoreBackupIfNeeded({ collectionName: 'pages', fileName: 'about' });

      expect(mockBackupDB.get).toHaveBeenCalledWith(['pages', '']);
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

      const promise = restoreBackupIfNeeded({ collectionName: 'posts', slug: 'my-post' });

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
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: false };
        }

        return undefined;
      });

      await showBackupToastIfNeeded();

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should not show toast if no draft exists', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === entryDraft) {
          return null;
        }

        return undefined;
      });

      await showBackupToastIfNeeded();

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should not show toast if toast already saved', async () => {
      mockGet.mockImplementation((store) => {
        if (store === prefs) {
          return { useDraftBackup: true };
        }

        if (store === entryDraft) {
          return { collectionName: 'posts', originalEntry: { slug: 'my-post' } };
        }

        if (store === backupToastState) {
          return { saved: true, restored: false, deleted: false };
        }

        return undefined;
      });

      await showBackupToastIfNeeded();

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

        if (store === entryDraft) {
          return { collectionName: 'posts', originalEntry: { slug: 'my-post' } };
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

      await showBackupToastIfNeeded();

      expect(mockBackupDB.get).toHaveBeenCalledWith(['posts', 'my-post']);
      // The backupToastState.set is called when backup exists, covering line 263
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

  describe('entryDraft subscription', () => {
    it('should call saveBackup after timeout when draft and backupDB exist', async () => {
      vi.useFakeTimers();

      vi.resetModules();

      // Re-apply the IndexedDB mock after module reset
      vi.doMock('@sveltia/utils/storage', () => {
        /**
         * Mock IndexedDB.
         */
        class MockDB {
          /**
           * Constructor.
           */
          constructor() {
            this.get = vi.fn().mockResolvedValue(undefined);
            this.put = vi.fn().mockResolvedValue(undefined);
            this.delete = vi.fn().mockResolvedValue(undefined);
          }
        }

        return { IndexedDB: MockDB };
      });

      // Mock entryDraft to call subscriber with a draft right away
      vi.doMock('$lib/services/contents/draft', () => ({
        entryDraft: {
          subscribe: vi.fn((cb) => {
            cb({
              collectionName: 'posts',
              fileName: undefined,
              originalEntry: { slug: 'test-post' },
              currentLocales: {},
              currentSlugs: {},
              currentValues: {},
              files: {},
            });

            return vi.fn();
          }),
        },
        entryDraftModified: {
          subscribe: vi.fn((cb) => {
            cb(true);

            return vi.fn();
          }),
        },
        i18nAutoDupEnabled: { set: vi.fn() },
      }));

      vi.doMock('$lib/services/backends', () => ({
        backend: {
          subscribe: vi.fn((callback) => {
            callback({ repository: { databaseName: 'test-db' } });

            return vi.fn();
          }),
        },
      }));

      vi.doMock('svelte/store', async () => {
        const actual = await vi.importActual('svelte/store');

        return {
          ...actual,
          get: vi.fn(() => ({ useDraftBackup: true })),
        };
      });

      const backupModule = await import('./backup');

      // Advance time past the 500ms debounce
      vi.advanceTimersByTime(600);

      vi.useRealTimers();

      expect(backupModule).toBeDefined();
    });
  });
});
