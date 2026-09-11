// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fillTemplate } from '$lib/services/common/template';
import { isEntryCollection } from '$lib/services/contents/collection';
import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
import { buildNestedMoveChanges } from '$lib/services/contents/collection/nested/move';
import { getPreviousSha } from '$lib/services/contents/draft/save/changes';
import { serializeContent } from '$lib/services/contents/draft/save/serialize';
import {
  buildSingleFileContent,
  createSyntheticDraft,
  resolveCacheDB,
} from '$lib/services/contents/entry/changes';
import { formatEntryFile } from '$lib/services/contents/file/format';

vi.mock('$lib/services/common/template', () => ({
  fillTemplate: vi.fn(),
}));

vi.mock('$lib/services/contents/collection', () => ({
  isEntryCollection: vi.fn(),
}));

vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));

vi.mock('$lib/services/contents/draft/save/changes', () => ({
  getPreviousSha: vi.fn(async () => 'sha'),
}));

vi.mock('$lib/services/contents/draft/save/serialize', () => ({
  serializeContent: vi.fn(() => ({ title: 'Serialized' })),
}));

vi.mock('$lib/services/contents/entry/changes', () => ({
  buildSingleFileContent: vi.fn(() => ({ title: 'Single' })),
  createSyntheticDraft: vi.fn(() => ({ synthetic: true })),
  resolveCacheDB: vi.fn(() => undefined),
}));

vi.mock('$lib/services/contents/file/format', () => ({
  formatEntryFile: vi.fn(async () => 'formatted'),
}));

/**
 * Create a single-locale entry.
 * @param {string} id Entry ID.
 * @param {string} subPath Entry’s sub path.
 * @returns {any} Entry.
 */
const entry = (id, subPath) => ({
  id,
  slug: subPath,
  subPath,
  locales: {
    en: { slug: subPath, path: `content/pages/${subPath}.md`, content: { title: subPath } },
  },
});

/** @type {any} */
const collection = {
  name: 'pages',
  folder: 'content/pages',
  nested: {},
  _file: { extension: 'md' },
  _i18n: {
    i18nEnabled: false,
    allLocales: ['en'],
    defaultLocale: 'en',
    structureMap: {},
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isEntryCollection).mockImplementation(
    (_collection) => typeof _collection?.folder === 'string' && !Array.isArray(_collection?.files),
  );
  vi.mocked(getPreviousSha).mockResolvedValue('sha');
  vi.mocked(createSyntheticDraft).mockReturnValue({ synthetic: true });
  vi.mocked(resolveCacheDB).mockReturnValue(undefined);
  vi.mocked(buildSingleFileContent).mockReturnValue({ title: 'Single' });
  vi.mocked(serializeContent).mockReturnValue({ title: 'Serialized' });
  vi.mocked(formatEntryFile).mockResolvedValue('formatted');
});

describe('buildNestedMoveChanges()', () => {
  test('returns nothing for a new entry', async () => {
    expect(
      await buildNestedMoveChanges({
        collection,
        originalEntry: undefined,
        savingEntry: entry('1', 'docs/_index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing for a collection that is not nested', async () => {
    expect(
      await buildNestedMoveChanges({
        collection: { ...collection, nested: undefined },
        originalEntry: entry('1', 'docs/_index'),
        savingEntry: entry('1', 'guides/_index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing when the collection doesn’t use subfolders', async () => {
    expect(
      await buildNestedMoveChanges({
        collection: { ...collection, nested: { subfolders: false } },
        originalEntry: entry('1', 'docs/intro'),
        savingEntry: entry('1', 'guides/intro'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing when the entry is in the collection folder', async () => {
    expect(
      await buildNestedMoveChanges({
        collection,
        originalEntry: entry('1', '_index'),
        savingEntry: entry('1', 'docs/_index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing when the folder hasn’t changed', async () => {
    expect(
      await buildNestedMoveChanges({
        collection,
        originalEntry: entry('1', 'docs/_index'),
        savingEntry: entry('1', 'docs/index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing when the entry would be moved into itself', async () => {
    expect(
      await buildNestedMoveChanges({
        collection,
        originalEntry: entry('1', 'docs/_index'),
        savingEntry: entry('1', 'docs/guides/_index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('returns nothing when the folder has no other entry', async () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([entry('1', 'docs/_index')]);

    expect(
      await buildNestedMoveChanges({
        collection,
        originalEntry: entry('1', 'docs/_index'),
        savingEntry: entry('1', 'guides/_index'),
      }),
    ).toEqual({ changes: [], savingEntries: [] });
  });

  test('moves every entry below the folder', async () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([
      entry('1', 'docs/_index'),
      entry('2', 'docs/intro/_index'),
      entry('3', 'docs/intro/deep/_index'),
      entry('4', 'other/_index'),
    ]);

    const { changes, savingEntries } = await buildNestedMoveChanges({
      collection,
      originalEntry: entry('1', 'docs/_index'),
      savingEntry: entry('1', 'guides/manual/_index'),
    });

    expect(changes).toEqual([
      {
        action: 'move',
        slug: 'guides/manual/intro/_index',
        path: 'content/pages/guides/manual/intro/_index.md',
        previousPath: 'content/pages/docs/intro/_index.md',
        previousSha: 'sha',
        data: 'formatted',
      },
      {
        action: 'move',
        slug: 'guides/manual/intro/deep/_index',
        path: 'content/pages/guides/manual/intro/deep/_index.md',
        previousPath: 'content/pages/docs/intro/deep/_index.md',
        previousSha: 'sha',
        data: 'formatted',
      },
    ]);

    expect(savingEntries.map(({ subPath }) => subPath)).toEqual([
      'guides/manual/intro/_index',
      'guides/manual/intro/deep/_index',
    ]);
  });

  test('moves the entries up to the collection folder', async () => {
    vi.mocked(getEntriesByCollection).mockReturnValue([
      entry('1', 'docs/_index'),
      entry('2', 'docs/intro/_index'),
    ]);

    const { changes } = await buildNestedMoveChanges({
      collection,
      originalEntry: entry('1', 'docs/_index'),
      savingEntry: entry('1', '_index'),
    });

    expect(changes[0].path).toBe('content/pages/intro/_index.md');
  });

  test('moves one file per locale with a file-per-locale i18n structure', async () => {
    /** @type {any} */
    const i18nCollection = {
      ...collection,
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr'],
        defaultLocale: 'en',
        structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: false },
      },
    };

    /**
     * Create an entry with two locales.
     * @param {string} id Entry ID.
     * @param {string} subPath Entry’s sub path.
     * @returns {any} Entry.
     */
    const i18nEntry = (id, subPath) => ({
      id,
      slug: subPath,
      subPath,
      locales: {
        en: { slug: subPath, path: `content/pages/${subPath}.en.md`, content: { title: 'EN' } },
        fr: { slug: subPath, path: `content/pages/${subPath}.fr.md`, content: undefined },
      },
    });

    vi.mocked(getEntriesByCollection).mockReturnValue([
      i18nEntry('1', 'docs/_index'),
      i18nEntry('2', 'docs/intro/_index'),
    ]);

    const { changes } = await buildNestedMoveChanges({
      collection: i18nCollection,
      originalEntry: i18nEntry('1', 'docs/_index'),
      savingEntry: i18nEntry('1', 'guides/_index'),
    });

    // The French file has no content, so it’s left out
    expect(changes).toEqual([
      {
        action: 'move',
        slug: 'guides/intro/_index',
        path: 'content/pages/guides/intro/_index.en.md',
        previousPath: 'content/pages/docs/intro/_index.en.md',
        previousSha: 'sha',
        data: 'formatted',
      },
    ]);
  });

  describe('with localized folders', () => {
    // @see https://github.com/sveltia/sveltia-cms/issues/962

    /** @type {any} */
    const i18nCollection = {
      ...collection,
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr'],
        defaultLocale: 'en',
        structureMap: { i18nSingleFile: false, i18nSingleFileDefaultRoot: false },
      },
    };

    /**
     * Create an entry stored at the given sub path in each locale.
     * @param {string} id Entry ID.
     * @param {Record<string, string>} subPaths Sub path per locale.
     * @returns {any} Entry.
     */
    const i18nEntry = (id, subPaths) => ({
      id,
      slug: subPaths.en,
      subPath: subPaths.en,
      locales: Object.fromEntries(
        Object.entries(subPaths).map(([locale, subPath]) => [
          locale,
          { slug: subPath, path: `content/pages/${locale}/${subPath}.md`, content: { title: id } },
        ]),
      ),
    });

    test('moves each locale’s file from and to the localized folder', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([
        i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        i18nEntry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' }),
      ]);

      const { changes, savingEntries } = await buildNestedMoveChanges({
        collection: i18nCollection,
        originalEntry: i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        savingEntry: i18nEntry('1', { en: 'company/_index', fr: 'entreprise/_index' }),
      });

      expect(changes).toEqual([
        expect.objectContaining({
          action: 'move',
          slug: 'company/team/_index',
          path: 'content/pages/en/company/team/_index.md',
          previousPath: 'content/pages/en/about/team/_index.md',
        }),
        expect.objectContaining({
          action: 'move',
          slug: 'entreprise/equipe/_index',
          path: 'content/pages/fr/entreprise/equipe/_index.md',
          previousPath: 'content/pages/fr/a-propos/equipe/_index.md',
        }),
      ]);
      expect(savingEntries[0]).toMatchObject({
        slug: 'company/team/_index',
        subPath: 'company/team/_index',
        locales: {
          en: { slug: 'company/team/_index' },
          fr: { slug: 'entreprise/equipe/_index' },
        },
      });
    });

    test('moves the descendants when the folder is renamed in one locale only', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([
        i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        i18nEntry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' }),
      ]);

      const { changes, savingEntries } = await buildNestedMoveChanges({
        collection: i18nCollection,
        originalEntry: i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        savingEntry: i18nEntry('1', { en: 'about/_index', fr: 'qui-sommes-nous/_index' }),
      });

      // The English file stays where it is
      expect(changes).toEqual([
        expect.objectContaining({
          action: 'move',
          path: 'content/pages/fr/qui-sommes-nous/equipe/_index.md',
          previousPath: 'content/pages/fr/a-propos/equipe/_index.md',
        }),
      ]);
      expect(savingEntries[0]).toMatchObject({
        subPath: 'about/team/_index',
        locales: {
          en: { slug: 'about/team/_index', path: 'content/pages/en/about/team/_index.md' },
          fr: { slug: 'qui-sommes-nous/equipe/_index' },
        },
      });
    });

    test('leaves a file that is not below the localized folder', async () => {
      // The French file was never localized, so it doesn’t follow the French folder
      vi.mocked(getEntriesByCollection).mockReturnValue([
        i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        i18nEntry('2', { en: 'about/team/_index', fr: 'about/team/_index' }),
      ]);

      const { changes } = await buildNestedMoveChanges({
        collection: i18nCollection,
        originalEntry: i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        savingEntry: i18nEntry('1', { en: 'company/_index', fr: 'entreprise/_index' }),
      });

      expect(changes).toEqual([
        expect.objectContaining({
          path: 'content/pages/en/company/team/_index.md',
          previousPath: 'content/pages/en/about/team/_index.md',
        }),
      ]);
    });

    test('falls back to the default locale’s folder for a locale the ancestor lacks', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([
        i18nEntry('1', { en: 'about/_index' }),
        i18nEntry('2', { en: 'about/team/_index', fr: 'about/equipe/_index' }),
      ]);

      const { changes } = await buildNestedMoveChanges({
        collection: i18nCollection,
        originalEntry: i18nEntry('1', { en: 'about/_index' }),
        // The ancestor gets the locale now, with a localized folder
        savingEntry: i18nEntry('1', { en: 'company/_index', fr: 'entreprise/_index' }),
      });

      expect(changes).toEqual([
        expect.objectContaining({
          path: 'content/pages/en/company/team/_index.md',
          previousPath: 'content/pages/en/about/team/_index.md',
        }),
        expect.objectContaining({
          path: 'content/pages/fr/entreprise/equipe/_index.md',
          previousPath: 'content/pages/fr/about/equipe/_index.md',
        }),
      ]);
    });

    test('falls back to the default locale’s folder for a locale the ancestor loses', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([
        i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        i18nEntry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' }),
      ]);

      const savingEntry = i18nEntry('1', { en: 'company/_index' });

      // The locale is being disabled, so only the file path is known
      savingEntry.locales.fr = { path: 'content/pages/fr/entreprise/_index.md' };

      const { changes } = await buildNestedMoveChanges({
        collection: i18nCollection,
        originalEntry: i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        savingEntry,
      });

      expect(changes).toEqual([
        expect.objectContaining({
          path: 'content/pages/en/company/team/_index.md',
          previousPath: 'content/pages/en/about/team/_index.md',
        }),
        expect.objectContaining({
          path: 'content/pages/fr/company/equipe/_index.md',
          previousPath: 'content/pages/fr/a-propos/equipe/_index.md',
        }),
      ]);
    });

    test('refreshes the canonical slug of every moved file', async () => {
      const localizedCollection = {
        ...i18nCollection,
        _type: 'entry',
        slug: '{{title | localize}}',
        _i18n: {
          ...i18nCollection._i18n,
          canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
        },
      };

      const original = i18nEntry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' });

      // The stale key links the files, and nothing else in the content is touched
      original.locales.en.content.translationKey = 'about/team/_index';
      original.locales.fr.content.translationKey = 'about/team/_index';
      vi.mocked(getEntriesByCollection).mockReturnValue([
        i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        original,
      ]);

      const { savingEntries } = await buildNestedMoveChanges({
        collection: localizedCollection,
        originalEntry: i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        savingEntry: i18nEntry('1', { en: 'company/_index', fr: 'entreprise/_index' }),
      });

      expect(savingEntries[0].locales.en.content).toEqual({
        title: '2',
        translationKey: 'company/team/_index',
      });
      expect(savingEntries[0].locales.fr.content).toEqual({
        title: '2',
        translationKey: 'company/team/_index',
      });
      // The entry in the store is left alone
      expect(original.locales.fr.content.translationKey).toBe('about/team/_index');
      expect(vi.mocked(serializeContent)).toHaveBeenCalledWith(
        expect.objectContaining({
          locale: 'fr',
          valueMap: expect.objectContaining({ translationKey: 'company/team/_index' }),
        }),
      );
    });

    test('fills a custom canonical slug template', async () => {
      const localizedCollection = {
        ...i18nCollection,
        _type: 'entry',
        slug: '{{title | localize}}',
        _i18n: {
          ...i18nCollection._i18n,
          canonicalSlug: { key: 'translationKey', value: 'page-{{slug}}' },
        },
      };

      vi.mocked(fillTemplate).mockImplementation((template, { currentSlug }) =>
        template.replace('{{slug}}', currentSlug),
      );
      vi.mocked(getEntriesByCollection).mockReturnValue([
        i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        i18nEntry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' }),
      ]);

      const { savingEntries } = await buildNestedMoveChanges({
        collection: localizedCollection,
        originalEntry: i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        savingEntry: i18nEntry('1', { en: 'company/_index', fr: 'entreprise/_index' }),
      });

      expect(savingEntries[0].locales.en.content.translationKey).toBe('page-company/team/_index');
      expect(fillTemplate).toHaveBeenCalledWith(
        'page-{{slug}}',
        expect.objectContaining({ locale: 'en', currentSlug: 'company/team/_index' }),
      );
    });

    test('fills a custom canonical slug template without the default locale’s content', async () => {
      // A pull request touching only a non-default locale leaves the entry without a default
      // locale file, and the template is still filled from what there is
      const localizedCollection = {
        ...i18nCollection,
        _type: 'entry',
        slug: '{{title | localize}}',
        _i18n: {
          ...i18nCollection._i18n,
          canonicalSlug: { key: 'translationKey', value: 'page-{{slug}}' },
        },
      };

      vi.mocked(fillTemplate).mockImplementation((template, { currentSlug }) =>
        template.replace('{{slug}}', currentSlug),
      );

      const descendant = i18nEntry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' });

      descendant.locales.en.content = undefined;
      vi.mocked(getEntriesByCollection).mockReturnValue([descendant]);

      const { savingEntries } = await buildNestedMoveChanges({
        collection: localizedCollection,
        originalEntry: i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        savingEntry: i18nEntry('1', { en: 'company/_index', fr: 'entreprise/_index' }),
      });

      expect(fillTemplate).toHaveBeenCalledWith(
        'page-{{slug}}',
        expect.objectContaining({ content: {}, currentSlug: 'company/team/_index' }),
      );
      expect(savingEntries[0].locales.fr.content.translationKey).toBe('page-company/team/_index');
    });

    test('skips a locale without content when refreshing the canonical slug', async () => {
      const localizedCollection = {
        ...i18nCollection,
        _type: 'entry',
        slug: '{{title | localize}}',
        _i18n: {
          ...i18nCollection._i18n,
          canonicalSlug: { key: 'translationKey', value: '{{slug}}' },
        },
      };

      const descendant = i18nEntry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' });

      descendant.locales.fr.content = undefined;
      vi.mocked(getEntriesByCollection).mockReturnValue([descendant]);

      const { savingEntries } = await buildNestedMoveChanges({
        collection: localizedCollection,
        originalEntry: i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        savingEntry: i18nEntry('1', { en: 'company/_index', fr: 'entreprise/_index' }),
      });

      expect(savingEntries[0].locales.fr.content).toBeUndefined();
      expect(savingEntries[0].locales.en.content.translationKey).toBe('company/team/_index');
    });

    test('leaves the content alone when the slugs are not localized', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([
        i18nEntry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' }),
      ]);

      const { savingEntries } = await buildNestedMoveChanges({
        collection: i18nCollection,
        originalEntry: i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        savingEntry: i18nEntry('1', { en: 'company/_index', fr: 'entreprise/_index' }),
      });

      expect(savingEntries[0].locales.en.content).toEqual({ title: '2' });
    });

    test('leaves a locale that has only a path', async () => {
      const descendant = i18nEntry('2', { en: 'about/team/_index', fr: 'a-propos/equipe/_index' });

      descendant.locales.fr = { path: 'content/pages/fr/a-propos/equipe/_index.md' };
      vi.mocked(getEntriesByCollection).mockReturnValue([descendant]);

      const { savingEntries } = await buildNestedMoveChanges({
        collection: i18nCollection,
        originalEntry: i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        savingEntry: i18nEntry('1', { en: 'company/_index', fr: 'entreprise/_index' }),
      });

      expect(savingEntries[0].locales.fr).toEqual({
        path: 'content/pages/fr/a-propos/equipe/_index.md',
      });
    });

    test('returns nothing when no file moves', async () => {
      vi.mocked(getEntriesByCollection).mockReturnValue([
        i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
        i18nEntry('2', { en: 'about/team/_index', fr: 'about/equipe/_index' }),
      ]);

      expect(
        await buildNestedMoveChanges({
          collection: i18nCollection,
          originalEntry: i18nEntry('1', { en: 'about/_index', fr: 'a-propos/_index' }),
          savingEntry: i18nEntry('1', { en: 'about/_index', fr: 'qui-sommes-nous/_index' }),
        }),
      ).toEqual({ changes: [], savingEntries: [] });
    });
  });
});
