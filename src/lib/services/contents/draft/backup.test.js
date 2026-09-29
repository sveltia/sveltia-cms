// @ts-nocheck
// @vitest-environment happy-dom

import { isProxy } from 'node:util/types';

import { IndexedDB } from '@sveltia/utils/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfigVersion } from '$lib/services/config';
import { isDraftModified } from '$lib/services/contents/draft';
import { createState } from '$lib/services/utils/state.svelte';

vi.mock('@sveltia/utils/storage');
vi.mock('@sveltia/utils/file', () => ({
  getBlobRegex: vi.fn((flags = '') => new RegExp('\\bblob:http://localhost/[\\w-]+\\b', flags)),
}));
vi.mock('@sveltia/utils/object', () => ({
  toRaw: vi.fn((val) => val),
}));

const { toRaw } = await import('@sveltia/utils/object');

vi.mock('$lib/services/assets/info', () => ({
  // The real helper wraps an SVG image; the URL is all that matters here
  createDisplayBlobURL: vi.fn(async (/** @type {Blob} */ blob) => URL.createObjectURL(blob)),
}));
vi.mock('$lib/services/config', () => ({
  cmsConfigVersion: { current: undefined },
}));
// Mock only the modification check, so the real `suspendAutoDuplication` still runs its callback
vi.mock('$lib/services/contents/draft', async () => ({
  ...(await vi.importActual('$lib/services/contents/draft')),
  isDraftModified: vi.fn(() => false),
}));
vi.mock('$lib/services/contents/draft/create/proxy.svelte', () => ({
  createProxy: vi.fn(({ target }) => target),
}));
vi.mock('$lib/services/contents/collection/entries/reorder/config', () => ({
  getOrderFieldKey: vi.fn(() => undefined),
}));
vi.mock('$lib/services/backends', () => ({
  // Simulate the backend being initialized
  backend: { current: { repository: { databaseName: 'test-db' } } },
}));

const mockPrefs = vi.hoisted(() => ({ useDraftBackup: /** @type {boolean | undefined} */ (true) }));

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: mockPrefs,
}));

describe('draft/backup', () => {
  /** @type {any} */
  const mockBackupDB = {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };

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

    // Wait for the effect that initializes the database
    await new Promise((resolve) => {
      setTimeout(resolve);
    });

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

    // Mock stores
    mockPrefs.useDraftBackup = true;
    cmsConfigVersion.current = 'v1.0.0';
    backupModule.backupToastState.current = { saved: false, restored: false, deleted: false };
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
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';
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

    it('should include the pending entries as plain objects', async () => {
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';
      vi.mocked(isDraftModified).mockReturnValue(true);
      interacted = true;

      const pendingEntry = {
        collectionName: 'tags',
        entry: { id: 'new', slug: 'svelte', subPath: 'svelte', locales: {} },
        changes: [{ action: 'create', path: 'content/tags/svelte.md', data: 'title: Svelte' }],
        savingAssets: [],
        values: ['svelte'],
      };

      const draft = createState({
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: { slug: 'my-post' },
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { 'tags.0': 'svelte' } },
        files: {},
        interacted,
        pendingEntries: [pendingEntry],
      });

      await saveBackup(/** @type {any} */ (draft));

      const [backup] = mockBackupDB.put.mock.calls[0];

      expect(backup.pendingEntries).toEqual([pendingEntry]);
      // Detached from the reactive draft, so IndexedDB can clone it
      expect(backup.pendingEntries[0]).not.toBe(draft.pendingEntries[0]);
    });

    it('should not save backup when draft is not modified', async () => {
      mockPrefs.useDraftBackup = true;
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
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';
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
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';
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
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';
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
      const randomValues = new Map([['undefined:uuid_short', 'abc123']]);

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
            subfolderPath: 'products',
          }),
          'blob:http://localhost/def': proxify({
            file,
            folder: undefined,
            replace: false,
            nameTemplate: proxify({
              template: '{{slug}}-{{uuid_short}}',
              randomValues,
              dateTimeParts: proxify({ year: '2026' }),
            }),
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
        // Picked while browsing a subfolder in the asset picker, so it’s saved there on restore
        subfolderPath: 'products',
      });
      // The file name template is kept, along with its random values in a `Map`
      expect(backup.files['blob:http://localhost/def']).toEqual({
        file,
        folder: undefined,
        replace: false,
        nameTemplate: {
          template: '{{slug}}-{{uuid_short}}',
          randomValues: new Map([['undefined:uuid_short', 'abc123']]),
          dateTimeParts: { year: '2026' },
        },
      });
      expect(backup.files['blob:http://localhost/def'].nameTemplate.randomValues).not.toBe(
        randomValues,
      );
    });

    it('should keep a file without a folder as is', async () => {
      mockPrefs.useDraftBackup = true;
      vi.mocked(isDraftModified).mockReturnValue(true);
      interacted = true;

      const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });

      const draft = {
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: { slug: 'my-post' },
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        // A file added by a custom field, which is not tied to a folder
        files: { 'blob:http://localhost/def': { file, folder: undefined, replace: true } },
        interacted: true,
      };

      await saveBackup(draft);

      const [backup] = mockBackupDB.put.mock.calls[0];

      expect(backup.files['blob:http://localhost/def']).toEqual({
        file,
        folder: undefined,
        replace: true,
      });
    });

    it('should not save backup when user has not interacted with the editor', async () => {
      mockPrefs.useDraftBackup = true;
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

    it('should not save backup for a read-only entry', async () => {
      mockPrefs.useDraftBackup = true;
      vi.mocked(isDraftModified).mockReturnValue(true);

      const draft = {
        collection: { name: 'posts', readonly: true },
        collectionName: 'posts',
        fileName: undefined,
        originalEntry: { slug: 'my-post' },
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { title: 'My Post' } },
        files: {},
        interacted: true,
      };

      await saveBackup(draft);

      expect(mockBackupDB.put).not.toHaveBeenCalled();
    });

    it('should not save backup for an entry stored in a file with the other entries', async () => {
      mockPrefs.useDraftBackup = true;
      vi.mocked(isDraftModified).mockReturnValue(true);

      // The slug is the position in the array, which another entry can take after a reorder
      const draft = {
        collectionName: 'members',
        fileName: undefined,
        originalEntry: { slug: '2', arrayIndex: 2 },
        currentLocales: { _default: true },
        currentSlugs: { _default: '2' },
        currentValues: { _default: { name: 'Bob' } },
        files: {},
        interacted: true,
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
    /** @type {import('vitest').MockInstance} */
    let createObjectURL;

    beforeEach(() => {
      updatedDraft = createMockDraft();

      // Restoring a backup regenerates a blob URL for every file. happy-dom’s `createObjectURL()`
      // returns a random URL, so it’s stubbed with predictable ones that are unique per call
      let count = 0;

      createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
        count += 1;

        return `blob:http://localhost/restored-${count}`;
      });
    });

    afterEach(() => {
      createObjectURL.mockRestore();
    });

    it('should restore backup to entry draft without errors', async () => {
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

      await expect(restoreBackup({ backup, draft: updatedDraft })).resolves.toBeUndefined();
    });

    it('should restore the pending entries, or none for an older backup', async () => {
      const pendingEntry = {
        collectionName: 'tags',
        entry: { id: 'new', slug: 'svelte', subPath: 'svelte', locales: {} },
        changes: [],
        savingAssets: [],
        values: ['svelte'],
      };

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { 'tags.0': 'svelte' } },
        files: {},
      };

      updatedDraft = createMockDraft({ pendingEntries: [] });
      await restoreBackup({
        backup: { ...backup, pendingEntries: [pendingEntry] },
        draft: updatedDraft,
      });
      expect(updatedDraft.pendingEntries).toEqual([pendingEntry]);

      updatedDraft = createMockDraft({ pendingEntries: [] });
      await restoreBackup({ backup, draft: updatedDraft });
      expect(updatedDraft.pendingEntries).toEqual([]);
    });

    it('should update currentLocales and currentSlugs from backup', async () => {
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

      await restoreBackup({ backup, draft: updatedDraft });

      expect(updatedDraft.currentLocales).toEqual({ en: true, fr: false });
      expect(updatedDraft.currentSlugs).toEqual({ en: 'restored-post' });
    });

    it('should handle backup with blob URLs in values', async () => {
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

      await restoreBackup({ backup, draft: updatedDraft });

      // The old blob URL is dead once the page has been reloaded, so the file gets a new one, and
      // the value and the draft’s file map are updated to match
      expect(createObjectURL).toHaveBeenCalledWith(testFile);
      expect(updatedDraft.currentValues.en.content).toBe('blob:http://localhost/restored-1');
      expect(updatedDraft.files).toEqual({
        'blob:http://localhost/restored-1': { file: testFile, folder: undefined },
      });
    });

    it('should create the blob URLs for display, keeping the files for the upload', async () => {
      const { createDisplayBlobURL } = await import('$lib/services/assets/info');
      const svgFile = new File(['<svg><script/></svg>'], 'image.svg', { type: 'image/svg+xml' });

      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: { en: { image: 'blob:http://localhost/abc123' } },
        files: { 'blob:http://localhost/abc123': { file: svgFile, folder: undefined } },
      };

      await restoreBackup({ backup, draft: updatedDraft });

      // The file can be an SVG image copied from the repository, which must not run script on the
      // CMS origin if its URL is opened in a new tab
      expect(createDisplayBlobURL).toHaveBeenCalledExactlyOnceWith(svgFile);
      expect(updatedDraft.currentValues.en.image).toBe('blob:http://localhost/restored-1');
      expect(updatedDraft.files['blob:http://localhost/restored-1'].file).toBe(svgFile);
    });

    it('should handle blob URL where value is already in fileURLs cache', async () => {
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

      await restoreBackup({ backup, draft: updatedDraft });

      // One file, one new URL, however many values refer to it
      expect(createObjectURL).toHaveBeenCalledOnce();
      expect(updatedDraft.currentValues.en).toEqual({
        image1: 'blob:http://localhost/restored-1',
        image2: 'blob:http://localhost/restored-1',
      });
      expect(Object.keys(updatedDraft.files)).toEqual(['blob:http://localhost/restored-1']);
    });

    it('should skip blob URLs whose cache entry has no file property (legacy format)', async () => {
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

      await restoreBackup({ backup, draft: updatedDraft });

      // Legacy format is no longer migrated — the blob URL is skipped entirely
      expect(Object.keys(updatedDraft.files)).toHaveLength(0);
    });

    it('should skip blob URLs that have no matching file in cache', async () => {
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

      await expect(restoreBackup({ backup, draft: updatedDraft })).resolves.toBeUndefined();
    });

    it('should handle multiple blob URLs in same content string', async () => {
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

      await restoreBackup({ backup, draft: updatedDraft });

      expect(updatedDraft.currentValues.en.content).toBe(
        'Image1: blob:http://localhost/restored-1 Image2: blob:http://localhost/restored-2',
      );
      expect(updatedDraft.files).toEqual({
        'blob:http://localhost/restored-1': { file: file1, folder: undefined },
        'blob:http://localhost/restored-2': { file: file2, folder: undefined },
      });
    });

    it('should replace existing locale values when locale already has content', async () => {
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

      const existingLocaleContent = { title: 'Old Title', body: 'Old Body', extra: 'drop' };

      updatedDraft = createMockDraft({
        currentValues: { en: existingLocaleContent },
        originalValues: { en: { title: 'Original' } },
      });

      await restoreBackup({ backup, draft: updatedDraft });

      // The content is updated in place, as the draft holds a proxy around it
      expect(updatedDraft.currentValues.en).toBe(existingLocaleContent);
      expect(updatedDraft.currentValues.en).toEqual({ title: 'New Title', body: 'New Body' });
    });

    // https://github.com/sveltia/sveltia-cms/issues/985
    it('should drop the stale keys of shifted list items', async () => {
      // The entry as loaded from the file: three items, the first with the longest nested list
      const loadedContent = {
        'releases.0.version': '3',
        'releases.0.features.0': 'A1',
        'releases.0.features.1': 'A2',
        'releases.0.features.2': 'A3',
        'releases.1.version': '2',
        'releases.1.features.0': 'B1',
        'releases.2.version': '1',
        'releases.2.features.0': 'C1',
      };

      // The backup taken after the first item was removed, so every key has shifted up
      const backup = {
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'release-notes',
        slug: 'release-notes',
        currentLocales: { en: true },
        currentSlugs: {},
        currentValues: {
          en: {
            'releases.0.version': '2',
            'releases.0.features.0': 'B1',
            'releases.1.version': '1',
            'releases.1.features.0': 'C1',
          },
        },
        files: {},
      };

      updatedDraft = createMockDraft({
        collectionName: 'release-notes',
        fileName: 'release-notes',
        currentValues: { en: loadedContent },
        originalValues: { en: structuredClone(loadedContent) },
      });

      await restoreBackup({ backup, draft: updatedDraft });

      // Neither `releases.0.features.1`/`.2` nor the third item survive the restoration
      expect(updatedDraft.currentValues.en).toEqual(backup.currentValues.en);
    });

    it('should create proxy for locale that does not yet have content', async () => {
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

      await expect(restoreBackup({ backup, draft: updatedDraft })).resolves.toBeUndefined();
    });

    it('should initialize originalValues for locales that previously had none', async () => {
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

      await expect(restoreBackup({ backup, draft: updatedDraft })).resolves.toBeUndefined();
    });

    it('should handle file collection with fileName', async () => {
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

      await expect(restoreBackup({ backup, draft: updatedDraft })).resolves.toBeUndefined();
    });

    it('should skip non-string values in currentValues during restore', async () => {
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

      await expect(restoreBackup({ backup, draft: updatedDraft })).resolves.toBeUndefined();
    });

    it('replaces a null optional object field with an empty object when child values exist', async () => {
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

      await restoreBackup({ backup, draft: updatedDraft });

      expect(updatedDraft.currentValues.en.author).toEqual({});
      expect(updatedDraft.currentValues.en['author.name']).toBe('Alice');
    });

    it('reconciles a stale order field with the live entry value when originalEntry exists', async () => {
      const { getOrderFieldKey } =
        await import('$lib/services/contents/collection/entries/reorder/config');

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

      await restoreBackup({ backup, draft: updatedDraft });

      // The restored order should use the live value (7), not the stale backup value (3)
      expect(updatedDraft.currentValues.en.order).toBe(7);
    });

    it('removes the order field when originalEntry does not exist (new entry)', async () => {
      const { getOrderFieldKey } =
        await import('$lib/services/contents/collection/entries/reorder/config');

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

      await restoreBackup({ backup, draft: updatedDraft });

      const capturedValueMap = backup.currentValues.en;

      // The order field should be removed so assignManualSortOrder can recompute it at save time
      expect('order' in capturedValueMap).toBe(false);
    });
  });

  describe('stores', () => {
    it('should initialize restoreDialogState with show: false', async () => {
      expect(restoreDialogState.current).toEqual({ show: false });
    });

    it('should initialize backupToastState with default state', async () => {
      expect(backupToastState.current).toEqual({
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

      await restoreBackupIfNeeded({ draft: createRestoreDraft() });

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should leave the backup alone for a read-only entry', async () => {
      mockPrefs.useDraftBackup = true;

      await restoreBackupIfNeeded({
        draft: createRestoreDraft({ collection: { name: 'posts', readonly: true } }),
      });

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should not restore to an entry stored in a file with the other entries', async () => {
      mockPrefs.useDraftBackup = true;

      await restoreBackupIfNeeded({
        draft: createRestoreDraft({ originalEntry: { slug: '2', arrayIndex: 2 } }),
      });

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should default to enabled when useDraftBackup is undefined', async () => {
      mockPrefs.useDraftBackup = undefined;

      mockBackupDB.get.mockResolvedValue(undefined);

      await restoreBackupIfNeeded({ draft: createRestoreDraft() });

      // Should proceed to check for backup since useDraftBackup defaults to true
      expect(mockBackupDB.get).toHaveBeenCalledWith(['posts', 'my-post']);
    });

    it('should not restore if backup does not exist', async () => {
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';

      mockBackupDB.get.mockResolvedValue(undefined);

      await restoreBackupIfNeeded({ draft: createRestoreDraft() });

      expect(mockBackupDB.get).toHaveBeenCalledWith(['posts', 'my-post']);
    });

    it('should create display URLs only for the files a restored value refers to', async () => {
      const { createDisplayBlobURL } = await import('$lib/services/assets/info');

      const svg = new File(['<svg><script>alert(1)</script></svg>'], 'a.svg', {
        type: 'image/svg+xml',
      });

      const unused = new File(['<svg/>'], 'b.svg', { type: 'image/svg+xml' });
      const png = new File(['png'], 'c.png', { type: 'image/png' });
      const urls = new Map([svg, unused, png].map((file, i) => [file, `blob:x/${i}`]));

      const createObjectURL = vi
        .spyOn(URL, 'createObjectURL')
        .mockImplementation((blob) => /** @type {string} */ (urls.get(/** @type {File} */ (blob))));

      mockBackupDB.get.mockResolvedValue({
        timestamp: new Date(),
        cmsConfigVersion: 'v1.0.0',
        collectionName: 'posts',
        slug: 'my-post',
        currentLocales: { en: true },
        currentSlugs: { en: 'my-post' },
        currentValues: {
          en: { image: 'blob:http://localhost/old1', photo: 'blob:http://localhost/old3' },
        },
        files: {
          'blob:http://localhost/old1': { file: svg },
          'blob:http://localhost/old2': { file: unused },
          'blob:http://localhost/old3': { file: png },
        },
      });

      const draft = createRestoreDraft();

      try {
        const promise = restoreBackupIfNeeded({ draft });

        await vi.waitFor(() => expect(restoreDialogState.current?.resolve).toBeDefined());
        restoreDialogState.current.resolve(true);
        await promise;

        // The helper makes an SVG image’s URL point to a wrapper that can’t run script, see
        // `getDisplayBlob()`, while the file itself is what gets saved. A file no value refers to
        // gets no URL at all, so there’s nothing to release
        expect(createDisplayBlobURL).toHaveBeenCalledTimes(2);
        expect(createDisplayBlobURL).toHaveBeenCalledWith(svg);
        expect(createDisplayBlobURL).toHaveBeenCalledWith(png);
        expect(createDisplayBlobURL).not.toHaveBeenCalledWith(unused);
        expect(draft.currentValues.en).toEqual({ image: 'blob:x/0', photo: 'blob:x/2' });
        expect(draft.files).toEqual({
          'blob:x/0': { file: svg },
          'blob:x/2': { file: png },
        });
      } finally {
        createObjectURL.mockRestore();
      }
    });

    it('should show restore dialog and restore backup when user confirms', async () => {
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';

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
      const dialogState = restoreDialogState.current;

      if (dialogState?.resolve) {
        dialogState.resolve(true);
      }

      await promise;

      // Check that toast state was updated
      const toastState = backupToastState.current;

      expect(toastState).toEqual({
        saved: false,
        restored: true,
        deleted: false,
      });
    });

    it('should delete backup when user cancels restore', async () => {
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';

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
      const dialogState = restoreDialogState.current;

      if (dialogState?.resolve) {
        dialogState.resolve(false);
      }

      await promise;

      expect(mockBackupDB.delete).toHaveBeenCalledWith(['posts', 'my-post']);

      // Check that toast state was updated
      const toastState = backupToastState.current;

      expect(toastState).toEqual({
        saved: false,
        restored: false,
        deleted: true,
      });
    });

    it('should handle file collection with fileName', async () => {
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';

      mockBackupDB.get.mockResolvedValue(undefined);

      await restoreBackupIfNeeded({
        draft: createRestoreDraft({ collectionName: 'pages', fileName: 'about' }),
      });

      expect(mockBackupDB.get).toHaveBeenCalledWith(['pages', 'about']);
    });

    it('should return early when dialog is dismissed without selecting an option', async () => {
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';

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
      const dialogState = restoreDialogState.current;

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

      await showBackupToastIfNeeded(undefined);

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should default to enabled when useDraftBackup is undefined', async () => {
      mockPrefs.useDraftBackup = undefined;

      await showBackupToastIfNeeded(null);

      // Should proceed past the pref check (draft is null so no DB call)
      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should not show toast if no draft exists', async () => {
      mockPrefs.useDraftBackup = true;

      await showBackupToastIfNeeded(null);

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should not show toast if toast already saved', async () => {
      mockPrefs.useDraftBackup = true;
      backupToastState.current = { saved: true, restored: false, deleted: false };

      await showBackupToastIfNeeded({
        collectionName: 'posts',
        originalEntry: { slug: 'my-post' },
      });

      expect(mockBackupDB.get).not.toHaveBeenCalled();
    });

    it('should show toast when backup exists', async () => {
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';
      backupToastState.current = { saved: false, restored: false, deleted: false };

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
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';
      backupToastState.current = { saved: false, restored: false, deleted: false };

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
      mockPrefs.useDraftBackup = true;
      cmsConfigVersion.current = 'v1.0.0';
      backupToastState.current = { saved: false, restored: false, deleted: false };

      mockBackupDB.get.mockResolvedValue(null);

      await showBackupToastIfNeeded({ collectionName: 'posts', originalEntry: undefined });

      // Called with '' slug (new entry: originalEntry?.slug → undefined → ?? '' → '')
      expect(mockBackupDB.get).toHaveBeenCalledWith(['posts', '']);
    });
  });

  describe('resetBackupToastState', () => {
    it('should reset toast state to default', () => {
      // First set some values
      backupToastState.current = { saved: true, restored: true, deleted: true };

      // Reset
      resetBackupToastState();

      const state = backupToastState.current;

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

  describe('backend effect', () => {
    it('should not use a database when the backend has no repository', async () => {
      // Re-import to get a fresh backend effect
      vi.resetModules();

      // Mock backend without repository
      vi.doMock('$lib/services/backends', () => ({
        backend: { current: { repository: undefined } },
      }));

      const { deleteBackup: _deleteBackup } = await import('./backup');

      // Wait for the effect that initializes the database
      await new Promise((resolve) => {
        setTimeout(resolve);
      });

      await _deleteBackup('posts', 'my-post');

      expect(mockBackupDB.delete).not.toHaveBeenCalled();
    });

    it('should not use a database when the repository has no database name', async () => {
      vi.resetModules();

      vi.doMock('$lib/services/backends', () => ({
        backend: { current: { repository: { databaseName: undefined } } },
      }));

      const { deleteBackup: _deleteBackup } = await import('./backup');

      await new Promise((resolve) => {
        setTimeout(resolve);
      });

      await _deleteBackup('posts', 'my-post');

      expect(mockBackupDB.delete).not.toHaveBeenCalled();
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

  describe('backend effect without a backend', () => {
    it('should not use a database when there is no backend', async () => {
      vi.resetModules();

      vi.doMock('$lib/services/backends', () => ({
        backend: { current: null },
      }));

      const { deleteBackup: _deleteBackup } = await import('./backup');

      await new Promise((resolve) => {
        setTimeout(resolve);
      });

      await _deleteBackup('posts', 'my-post');

      expect(mockBackupDB.delete).not.toHaveBeenCalled();
    });
  });
});
