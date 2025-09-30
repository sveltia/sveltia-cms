// @ts-nocheck
import { IndexedDB } from '@sveltia/utils/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { siteConfigVersion } from '$lib/services/config';
import { entryDraftModified } from '$lib/services/contents/draft';
import { prefs } from '$lib/services/user/prefs';

vi.mock('@sveltia/utils/storage');
vi.mock('$lib/services/config');
vi.mock('$lib/services/contents/draft');
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
  let restoreBackupIfNeeded;
  let showBackupToastIfNeeded;
  let resetBackupToastState;
  let entryDraft;

  // Mock IndexedDB constructor to return our mock (must happen before importing backup module)
  vi.mocked(IndexedDB).mockReturnValue(mockBackupDB);

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

      if (store === siteConfigVersion) {
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
        siteConfigVersion: 'v1.0.0',
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
        siteConfigVersion: 'v0.9.0',
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
        siteConfigVersion: 'v1.0.0',
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

        if (store === siteConfigVersion) {
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
          siteConfigVersion: 'v1.0.0',
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

        if (store === entryDraftModified) {
          return false;
        }

        return undefined;
      });

      const existingBackup = {
        timestamp: new Date(),
        siteConfigVersion: 'v1.0.0',
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

        if (store === siteConfigVersion) {
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

        if (store === siteConfigVersion) {
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

        if (store === siteConfigVersion) {
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

        if (store === siteConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });

      const backup = {
        timestamp: new Date(),
        siteConfigVersion: 'v1.0.0',
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

        if (store === siteConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });

      const backup = {
        timestamp: new Date(),
        siteConfigVersion: 'v1.0.0',
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

        if (store === siteConfigVersion) {
          return 'v1.0.0';
        }

        return undefined;
      });

      mockBackupDB.get.mockResolvedValue(undefined);

      await restoreBackupIfNeeded({ collectionName: 'pages', fileName: 'about' });

      expect(mockBackupDB.get).toHaveBeenCalledWith(['pages', '']);
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
        siteConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
      };

      mockBackupDB.get.mockResolvedValue(backup);

      await showBackupToastIfNeeded();

      expect(mockBackupDB.get).toHaveBeenCalled();
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
});
