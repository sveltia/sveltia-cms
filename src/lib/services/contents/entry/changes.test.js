// @ts-nocheck

import { IndexedDB } from '@sveltia/utils/storage';
import { writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { backend } from '$lib/services/backends';
import {
  buildEntryUpdateChanges,
  buildSingleFileContent,
  createSyntheticDraft,
  resolveCacheDB,
} from '$lib/services/contents/entry/changes';

vi.mock('$lib/services/backends', () => ({ backend: writable(null) }));

vi.mock('$lib/services/contents/draft/save/changes', () => ({
  getPreviousSha: vi.fn(async ({ previousPath }) =>
    previousPath ? `sha:${previousPath}` : undefined,
  ),
}));

vi.mock('$lib/services/contents/draft/save/serialize', () => ({
  serializeContent: vi.fn(({ valueMap }) => ({ ...valueMap })),
}));

vi.mock('$lib/services/contents/file/format', () => ({
  formatEntryFile: vi.fn(async ({ content }) => `formatted:${JSON.stringify(content)}`),
}));

vi.mock('@sveltia/utils/storage', () => ({ IndexedDB: vi.fn() }));

const _file = { format: 'yaml-frontmatter' };

beforeEach(() => {
  vi.clearAllMocks();
  backend.set(null);
});

describe('createSyntheticDraft()', () => {
  test('uses the collection fields', () => {
    const collection = { name: 'posts', fields: [{ name: 'title' }] };

    expect(createSyntheticDraft({ collection })).toEqual({
      collection,
      collectionName: 'posts',
      collectionFile: undefined,
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
      fields: collectionFile.fields,
      isIndexFile: true,
    });
  });
});

describe('resolveCacheDB()', () => {
  test('returns the provided handle', () => {
    const provided = { get: vi.fn() };

    expect(resolveCacheDB(provided)).toBe(provided);
    expect(IndexedDB).not.toHaveBeenCalled();
  });

  test('opens a handle for the current backend', () => {
    backend.set({ repository: { databaseName: 'db' } });
    resolveCacheDB();
    expect(IndexedDB).toHaveBeenCalledWith('db', 'file-cache');
  });

  test('returns undefined when no backend is configured', () => {
    expect(resolveCacheDB()).toBeUndefined();
  });
});

describe('buildSingleFileContent()', () => {
  const entry = {
    slug: 'a',
    locales: {
      en: { slug: 'a', path: 'a.md', content: { title: 'Hello' } },
      fr: { slug: 'a', path: 'a.md', content: { title: 'Bonjour' } },
      de: { slug: 'a', path: 'a.md' },
    },
  };

  test('serializes the default locale only when i18n is disabled', () => {
    const config = { _i18n: { i18nEnabled: false, defaultLocale: 'en' } };

    expect(buildSingleFileContent({ config, entry, draft: {} })).toEqual({ title: 'Hello' });
  });

  test('nests the locales for single-file i18n', () => {
    const config = { _i18n: { i18nEnabled: true, defaultLocale: 'en' } };

    expect(buildSingleFileContent({ config, entry, draft: {} })).toEqual({
      en: { title: 'Hello' },
      fr: { title: 'Bonjour' },
    });
  });

  test('puts the default locale at the root for `single_file_default_root`', () => {
    const config = {
      _i18n: {
        i18nEnabled: true,
        defaultLocale: 'en',
        structureMap: { i18nSingleFileDefaultRoot: true },
      },
    };

    expect(buildSingleFileContent({ config, entry, draft: {} })).toEqual({
      lang: ['en', 'fr'],
      title: 'Hello',
      fr: { title: 'Bonjour' },
    });
  });

  test('drops a stale root-level `lang` property', () => {
    const config = {
      _i18n: {
        i18nEnabled: true,
        defaultLocale: 'en',
        structureMap: { i18nSingleFileDefaultRoot: true },
      },
    };

    const result = buildSingleFileContent({
      config,
      entry: { locales: { en: { content: { lang: ['xx'], title: 'Hello' } } } },
      draft: {},
    });

    expect(result).toEqual({ lang: ['en'], title: 'Hello' });
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

    expect(await buildEntryUpdateChanges({ collection, entry, draft: {} })).toEqual([
      {
        action: 'update',
        slug: 'a',
        path: 'content/a.md',
        previousSha: 'sha:content/a.md',
        data: 'formatted:{"title":"A"}',
      },
    ]);
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
