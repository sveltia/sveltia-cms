// @ts-nocheck

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getArrayItemTarget } from '$lib/services/contents/draft/save/changes';
import {
  buildEntryUpdateChanges,
  createSyntheticDraft,
} from '$lib/services/contents/entry/changes';
import { formatEntryFile } from '$lib/services/contents/file/format';

vi.mock('$lib/services/contents/draft/save/changes', () => ({
  getArrayItemTarget: vi.fn((entry) =>
    entry.arrayIndex === undefined
      ? {}
      : { arrayItem: { index: entry.arrayIndex, locales: entry.locales } },
  ),
}));

vi.mock('$lib/services/contents/draft/save/serialize', () => ({
  serializeContent: vi.fn(({ valueMap }) => ({ ...valueMap })),
}));

vi.mock('$lib/services/contents/file/format', () => ({
  formatEntryFile: vi.fn(async ({ content }) => `formatted:${JSON.stringify(content)}`),
}));

const _file = { format: 'yaml-frontmatter' };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createSyntheticDraft()', () => {
  test('uses the collection fields', () => {
    const collection = { name: 'posts', fields: [{ name: 'title' }] };

    expect(createSyntheticDraft({ collection })).toEqual({
      collection,
      collectionName: 'posts',
      collectionFile: undefined,
      fileName: undefined,
      fields: collection.fields,
      isIndexFile: false,
    });
  });

  test('prefers the collection file fields', () => {
    const collection = { name: 'config', fields: [{ name: 'title' }] };
    const collectionFile = { name: 'general', fields: [{ name: 'site' }] };

    expect(createSyntheticDraft({ collection, collectionFile, isIndexFile: true })).toEqual({
      collection,
      collectionName: 'config',
      collectionFile,
      fileName: 'general',
      fields: collectionFile.fields,
      isIndexFile: true,
    });
  });
});

describe('buildEntryUpdateChanges()', () => {
  test('produces one change for a single-file entry', async () => {
    const collection = {
      name: 'posts',
      _file,
      _i18n: { i18nEnabled: false, defaultLocale: '_default' },
    };

    const entry = {
      slug: 'a',
      locales: { _default: { slug: 'a', path: 'content/a.md', content: { title: 'A' } } },
    };

    const cacheDB = { get: vi.fn(async (path) => ({ sha: `sha:${path}` })) };

    expect(await buildEntryUpdateChanges({ collection, entry, draft: {}, cacheDB })).toEqual([
      {
        action: 'update',
        slug: 'a',
        path: 'content/a.md',
        previousSha: 'sha:content/a.md',
        data: 'formatted:{"title":"A"}',
      },
    ]);
  });

  test('targets the item of an entry stored in an array file', async () => {
    const collection = {
      name: 'members',
      _file: { format: 'json', arrayFile: true },
      _i18n: { i18nEnabled: false, defaultLocale: '_default' },
    };

    const entry = {
      id: 'a',
      slug: 'a',
      arrayIndex: 2,
      locales: { _default: { slug: 'a', path: 'data/members.json', content: { title: 'New' } } },
    };

    const [change] = await buildEntryUpdateChanges({ collection, entry, draft: {} });

    // The item is looked up by `getArrayItemTarget()`, which reads the entry in the store
    expect(getArrayItemTarget).toHaveBeenCalledWith(entry);
    expect(change).toMatchObject({
      action: 'update',
      path: 'data/members.json',
      arrayItem: { index: 2, locales: entry.locales },
    });
  });

  test('produces one change per locale for multi-file i18n', async () => {
    const collection = {
      name: 'posts',
      _file,
      _i18n: { i18nEnabled: true, allLocales: ['en', 'fr', 'de'], defaultLocale: 'en' },
    };

    const entry = {
      slug: 'a',
      locales: {
        en: { slug: 'a', path: 'en/a.md', content: { title: 'A' } },
        fr: { slug: 'a', path: 'fr/a.md', content: { title: 'B' } },
        de: { slug: 'a', path: 'de/a.md' },
      },
    };

    const changes = await buildEntryUpdateChanges({ collection, entry, draft: {} });

    expect(changes).toHaveLength(2);
    expect(changes.map(({ path }) => path)).toEqual(['en/a.md', 'fr/a.md']);
  });

  test('skips a locale missing from a multi-file entry', async () => {
    const collection = {
      name: 'posts',
      _file,
      _i18n: { i18nEnabled: true, allLocales: ['en', 'fr'], defaultLocale: 'en' },
    };

    const entry = {
      slug: 'a',
      locales: { en: { slug: 'a', path: 'en/a.md', content: { title: 'A' } } },
    };

    const cacheDB = { get: vi.fn(async (path) => ({ sha: `sha:${path}` })) };

    expect(await buildEntryUpdateChanges({ collection, entry, draft: {}, cacheDB })).toEqual([
      {
        action: 'update',
        slug: 'a',
        path: 'en/a.md',
        previousSha: 'sha:en/a.md',
        data: 'formatted:{"title":"A"}',
      },
    ]);
  });

  test('passes the field comments for a single-file entry', async () => {
    const collection = {
      name: 'posts',
      _file,
      _i18n: {
        i18nEnabled: true,
        allLocales: ['en', 'fr'],
        defaultLocale: 'en',
        structureMap: { i18nSingleFile: true },
      },
    };

    const entry = {
      slug: 'a',
      locales: { en: { slug: 'a', path: 'content/a.md', content: { title: 'A' } } },
    };

    const draft = { fields: [{ name: 'title', comment: 'Title' }] };

    await buildEntryUpdateChanges({ collection, entry, draft });

    expect(vi.mocked(formatEntryFile).mock.calls[0][0].comments).toEqual({
      'en.title': 'Title',
      'fr.title': 'Title',
    });
  });

  test('passes the field comments for each file of a multi-file entry', async () => {
    const collection = {
      name: 'posts',
      _file,
      _i18n: { i18nEnabled: true, allLocales: ['en', 'fr'], defaultLocale: 'en' },
    };

    const entry = {
      slug: 'a',
      locales: {
        en: { slug: 'a', path: 'en/a.md', content: { title: 'A' } },
        fr: { slug: 'a', path: 'fr/a.md', content: { title: 'B' } },
      },
    };

    const draft = { fields: [{ name: 'title', comment: 'Title' }] };

    await buildEntryUpdateChanges({ collection, entry, draft });

    expect(vi.mocked(formatEntryFile).mock.calls.map(([{ comments }]) => comments)).toEqual([
      { title: 'Title' },
      { title: 'Title' },
    ]);
  });

  test('uses the collection file’s own configuration', async () => {
    const collection = { name: 'config', _file: { format: 'json' }, _i18n: { i18nEnabled: true } };

    const collectionFile = {
      name: 'general',
      _file,
      _i18n: { i18nEnabled: false, defaultLocale: '_default' },
    };

    const entry = {
      slug: 'general',
      locales: { _default: { slug: 'general', path: 'config.yml', content: { site: 'X' } } },
    };

    const [change] = await buildEntryUpdateChanges({
      collection,
      collectionFile,
      entry,
      draft: {},
    });

    expect(change.path).toBe('config.yml');
  });
});
