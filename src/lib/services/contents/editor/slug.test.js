// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getSharedEntryFileName,
  isNestedCollection,
} from '$lib/services/contents/collection/nested';
import { getSlugs, hasLocalizedSlugs } from '$lib/services/contents/draft/slugs';
import { getOtherEntries } from '$lib/services/contents/draft/validate/slugs';
import { getUnpublishedEntryByDraft } from '$lib/services/workflow';

import {
  canUpdateSlug,
  getOwnFolderPaths,
  getSlugPreviews,
  getTakenFolderNames,
  hasEntrySlug,
  needsSlugInput,
  renameEntryFolders,
  updateSlugs,
} from './slug';

vi.mock('$lib/services/contents/collection/nested', async (importOriginal) => ({
  ...(await importOriginal()),
  getSharedEntryFileName: vi.fn(),
  isNestedCollection: vi.fn(() => false),
}));
vi.mock('$lib/services/contents/draft/slugs', () => ({
  getSlugs: vi.fn(),
  hasLocalizedSlugs: vi.fn(() => false),
}));
vi.mock('$lib/services/contents/draft/validate/slugs', () => ({
  getOtherEntries: vi.fn(() => []),
}));
vi.mock('$lib/services/workflow', () => ({
  getUnpublishedEntryByDraft: vi.fn(),
  /**
   * Check whether the entry is awaiting deletion.
   * @param {any} entry Unpublished entry.
   * @returns {boolean} Result.
   */
  isPendingDeletion: (entry) => entry?.workflow?.status === 'pending_deletion',
}));

/**
 * Create an entry draft.
 * @param {object} [overrides] Property overrides.
 * @returns {any} Draft.
 */
const createDraft = (overrides = {}) => ({
  collection: { _type: 'entry' },
  isNew: false,
  isIndexFile: false,
  defaultLocale: 'en',
  slugEditor: {},
  currentSlugs: {},
  ...overrides,
});

describe('contents/editor/slug', () => {
  beforeEach(() => {
    vi.mocked(getSharedEntryFileName).mockReturnValue(undefined);
    vi.mocked(isNestedCollection).mockReturnValue(false);
    vi.mocked(getUnpublishedEntryByDraft).mockReturnValue(undefined);
    vi.mocked(hasLocalizedSlugs).mockReturnValue(false);
  });

  describe('hasEntrySlug', () => {
    it('should be true for an entry collection’s regular entry', () => {
      expect(hasEntrySlug(createDraft())).toBe(true);
    });

    it('should be false without a slug of its own', () => {
      expect(hasEntrySlug(undefined)).toBe(false);
      expect(hasEntrySlug(null)).toBe(false);
      expect(hasEntrySlug(createDraft({ collection: { _type: 'file' } }))).toBe(false);
      expect(hasEntrySlug(createDraft({ isIndexFile: true }))).toBe(false);
    });
  });

  describe('canUpdateSlug', () => {
    it('should be true for an existing entry by default', () => {
      expect(canUpdateSlug(createDraft())).toBe(true);
    });

    it('should follow the editable option, whatever the delete option says', () => {
      expect(canUpdateSlug(createDraft({ collection: { _type: 'entry', delete: false } }))).toBe(
        true,
      );
      expect(
        canUpdateSlug(createDraft({ collection: { _type: 'entry', slug: { editable: false } } })),
      ).toBe(false);
      expect(
        canUpdateSlug(
          createDraft({ collection: { _type: 'entry', slug: { editable: ['create'] } } }),
        ),
      ).toBe(false);
    });

    it('should be false for a new entry or an entry without a slug', () => {
      expect(canUpdateSlug(undefined)).toBe(false);
      expect(canUpdateSlug(createDraft({ isNew: true }))).toBe(false);
      expect(canUpdateSlug(createDraft({ isIndexFile: true }))).toBe(false);
    });

    it('should be false for an entry awaiting deletion', () => {
      vi.mocked(getUnpublishedEntryByDraft).mockReturnValue({
        workflow: { status: 'pending_deletion' },
      });
      expect(canUpdateSlug(createDraft())).toBe(false);
    });

    it('should be false for an entry identified by its path in a nested collection', () => {
      vi.mocked(isNestedCollection).mockReturnValue(true);
      expect(canUpdateSlug(createDraft())).toBe(false);

      // Unless every entry is an index file within a folder of its own
      vi.mocked(getSharedEntryFileName).mockReturnValue('index');
      expect(canUpdateSlug(createDraft())).toBe(true);
    });
  });

  describe('needsSlugInput', () => {
    it('should be true for a new entry whose slug comes from the slug editor alone', () => {
      expect(
        needsSlugInput(
          createDraft({
            isNew: true,
            collection: { _type: 'entry', slug: { editable: true } },
            slugEditor: { en: true, fr: 'readonly' },
          }),
        ),
      ).toBe(true);
    });

    it('should be false when the template can fill the slug', () => {
      expect(
        needsSlugInput(
          createDraft({
            isNew: true,
            collection: { _type: 'entry', slug: { template: '{{title}}', editable: true } },
            slugEditor: { en: true },
          }),
        ),
      ).toBe(false);
    });

    it('should be false without the slug editor or for an existing entry', () => {
      expect(needsSlugInput(undefined)).toBe(false);
      expect(
        needsSlugInput(
          createDraft({
            isNew: true,
            collection: { _type: 'entry', slug: { editable: true } },
            slugEditor: { en: false },
          }),
        ),
      ).toBe(false);
      expect(
        needsSlugInput(
          createDraft({
            collection: { _type: 'entry', slug: { editable: true } },
            slugEditor: { en: true },
          }),
        ),
      ).toBe(false);
      expect(
        needsSlugInput(
          createDraft({ isNew: true, collection: { _type: 'file' }, slugEditor: { en: true } }),
        ),
      ).toBe(false);
    });
  });

  describe('getSlugPreviews', () => {
    it('should return the slug shared by every locale', () => {
      vi.mocked(getSlugs).mockReturnValue({
        defaultLocaleSlug: 'hello',
        localizedSlugs: undefined,
        canonicalSlug: undefined,
      });

      const draft = createDraft({ isNew: true });

      expect(getSlugPreviews(draft)).toEqual({ _: 'hello' });
      expect(getSlugs).toHaveBeenCalledWith({ draft, templateOnly: false });

      getSlugPreviews(draft, { templateOnly: true });
      expect(getSlugs).toHaveBeenLastCalledWith({ draft, templateOnly: true });
    });

    it('should return the localized slugs of the enabled locales', () => {
      vi.mocked(getSlugs).mockReturnValue({
        defaultLocaleSlug: 'hello',
        localizedSlugs: { en: 'hello', fr: 'bonjour', de: 'hallo' },
        canonicalSlug: 'hello',
      });

      expect(
        getSlugPreviews(
          createDraft({ isNew: true, currentLocales: { en: true, fr: true, de: false } }),
        ),
      ).toEqual({ en: 'hello', fr: 'bonjour' });
    });
  });

  describe('getOwnFolderPaths', () => {
    /**
     * Create a draft for an existing entry stored as an index file within its own folder.
     * @param {object} [overrides] Property overrides.
     * @returns {any} Draft.
     */
    const createFolderDraft = (overrides = {}) =>
      createDraft({
        currentPath: '/guides/intro/',
        currentLocales: { en: true, fr: true, de: false },
        currentSlugs: { en: 'guides/intro/index', fr: 'guides/intro-fr/index', de: 'x/y/index' },
        ...overrides,
      });

    it('should return undefined for a new entry or a collection without shared file names', () => {
      expect(getOwnFolderPaths(createFolderDraft())).toBeUndefined();
      vi.mocked(getSharedEntryFileName).mockReturnValue('index');
      expect(getOwnFolderPaths(createFolderDraft({ isNew: true }))).toBeUndefined();
    });

    it('should return the shared folder when the slugs aren’t localized', () => {
      vi.mocked(getSharedEntryFileName).mockReturnValue('index');
      expect(getOwnFolderPaths(createFolderDraft())).toEqual({ en: 'guides/intro' });
    });

    it('should return the folder of each enabled locale when the slugs are localized', () => {
      vi.mocked(getSharedEntryFileName).mockReturnValue('index');
      vi.mocked(hasLocalizedSlugs).mockReturnValue(true);

      const draft = createFolderDraft();

      expect(getOwnFolderPaths(draft)).toEqual({ en: 'guides/intro', fr: 'guides/intro-fr' });

      // A localized slug without a folder of its own doesn’t count
      draft.currentSlugs.fr = 'index';

      expect(getOwnFolderPaths(draft)).toEqual({ en: 'guides/intro' });
    });
  });

  describe('getTakenFolderNames', () => {
    it('should collect the folders sharing a parent with the entry’s folder', () => {
      const ownEntry = { id: 'own', subPath: 'guides/intro/index', locales: {} };

      vi.mocked(getOtherEntries).mockReturnValue([
        // A version of the entry left behind under another path
        ownEntry,
        {
          id: '1',
          subPath: 'guides/setup/index',
          locales: { fr: { slug: 'guides/installation/index' } },
        },
        { id: '2', subPath: 'misc/other/index', locales: {} },
        { id: '3', subPath: undefined, locales: {} },
      ]);

      expect(
        getTakenFolderNames({
          draft: createDraft({ originalEntry: ownEntry }),
          ownFolderPaths: { en: 'guides/intro', fr: 'guides/intro-fr' },
        }),
      ).toEqual({ en: ['setup'], fr: ['installation'] });
    });
  });

  describe('updateSlugs', () => {
    it('should slugify the slugs', () => {
      const draft = createDraft({ currentSlugs: { en: 'hello', fr: 'bonjour' } });

      updateSlugs({ draft, slugs: { en: 'Hello World', fr: 'Bonjour' } });

      expect(draft.currentSlugs).toEqual({ en: 'hello-world', fr: 'bonjour' });
    });

    it('should only update the given locales', () => {
      const draft = createDraft({ currentSlugs: { en: 'Hello', fr: 'bonjour', de: undefined } });

      updateSlugs({ draft, slugs: { fr: 'Salut Monde' } });

      // The other locales’ slugs aren’t slugified again
      expect(draft.currentSlugs).toEqual({ en: 'Hello', fr: 'salut-monde', de: undefined });
    });
  });

  describe('renameEntryFolders', () => {
    it('should rename the folder in the default locale through the path', () => {
      const draft = createDraft({
        currentPath: 'docs/guides',
        currentSlugs: { _: 'docs/guides/index' },
      });

      renameEntryFolders({
        draft,
        ownFolderPaths: { en: 'docs/guides' },
        folderNames: { en: 'User Guides' },
      });

      expect(draft.currentPath).toBe('docs/user-guides');
      expect(draft.currentSlugs).toEqual({ _: 'docs/guides/index' });
    });

    it('should rename a localized folder within the localized slug', () => {
      const draft = createDraft({
        currentPath: 'docs/guides',
        currentSlugs: { en: 'docs/guides/index', fr: 'docs/guides-fr/index' },
      });

      renameEntryFolders({
        draft,
        ownFolderPaths: { en: 'docs/guides', fr: 'docs/guides-fr' },
        folderNames: { en: 'guides', fr: 'Manuels' },
      });

      expect(draft.currentPath).toBe('docs/guides');
      expect(draft.currentSlugs).toEqual({ en: 'docs/guides/index', fr: 'docs/manuels/index' });
    });
  });
});
