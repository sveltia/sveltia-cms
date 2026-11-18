// @vitest-environment happy-dom
// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getCollection } from '$lib/services/contents/collection';
import { buildDraft } from '$lib/services/contents/draft/create';
import { createEntryPath } from '$lib/services/contents/draft/save/entry-path';
import { getSlugs } from '$lib/services/contents/draft/slugs';
import { toggleLocale } from '$lib/services/contents/draft/update/locale';
import { initTestConfig } from '$lib/test/config';

/**
 * Load a collection storing its entries with the `{{year}}/{{slug}}` path and no date field, so the
 * year comes from the time of the save, in the given i18n structure.
 * @param {string} structure I18n structure.
 * @returns {Promise<any>} Collection.
 */
const loadCollection = async (structure) => {
  // The configuration is only loaded in a secure context
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

  await initTestConfig({
    i18n: { structure, locales: ['en', 'fr'] },
    collections: [
      {
        name: 'posts',
        folder: 'content/posts',
        i18n: true,
        path: '{{year}}/{{slug}}',
        fields: [{ name: 'title', widget: 'string', i18n: true }],
      },
    ],
  });

  return getCollection('posts');
};

/**
 * Get the path of each locale’s file, as the save would.
 * @param {any} draft Entry draft.
 * @returns {Record<string, string>} Paths keyed by locale.
 */
const getPaths = (draft) => {
  const { defaultLocaleSlug, localizedSlugs } = getSlugs({ draft });

  return Object.fromEntries(
    ['en', 'fr'].map((locale) => [
      locale,
      createEntryPath({ draft, locale, slug: localizedSlugs?.[locale] ?? defaultLocaleSlug }),
    ]),
  );
};

describe('contents/draft/save/entry-path (integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should save a locale enabled later alongside the entry’s file with `multiple_files`', async () => {
    const collection = await loadCollection('multiple_files');

    const draft = buildDraft({
      collection,
      originalEntry: {
        id: 'posts/2023/hello',
        slug: 'hello',
        subPath: '2023/hello',
        locales: {
          en: { slug: 'hello', path: 'content/posts/2023/hello.en.md', content: { title: 'Hi' } },
        },
      },
    });

    toggleLocale({ draft, locale: 'fr' });

    expect(getPaths(draft)).toEqual({
      en: 'content/posts/2023/hello.en.md',
      fr: 'content/posts/2023/hello.fr.md',
    });
  });

  it('should save a locale enabled later alongside the entry’s file with `multiple_folders`', async () => {
    const collection = await loadCollection('multiple_folders');

    const draft = buildDraft({
      collection,
      originalEntry: {
        id: 'posts/2023/hello',
        slug: 'hello',
        subPath: '2023/hello',
        locales: {
          en: { slug: 'hello', path: 'content/posts/en/2023/hello.md', content: { title: 'Hi' } },
        },
      },
    });

    toggleLocale({ draft, locale: 'fr' });

    expect(getPaths(draft)).toEqual({
      en: 'content/posts/en/2023/hello.md',
      fr: 'content/posts/fr/2023/hello.md',
    });
  });

  it('should fill the template for a new entry', async () => {
    const collection = await loadCollection('multiple_files');
    const draft = buildDraft({ collection });

    draft.currentValues.en.title = 'Hello';
    toggleLocale({ draft, locale: 'fr' });

    expect(getPaths(draft)).toEqual({
      en: 'content/posts/2026/hello.en.md',
      fr: 'content/posts/2026/hello.fr.md',
    });
  });
});
