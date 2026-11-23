// @vitest-environment happy-dom
// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getAssetFolder } from '$lib/services/assets/folders';
import { getCollection } from '$lib/services/contents/collection';
import { rewriteEntryAssetReferences } from '$lib/services/contents/draft/save/asset-references';
import { initTestConfig, setAssets } from '$lib/test/config';

/**
 * Fields holding asset references in every form the save rewrites.
 */
const fields = [
  { name: 'title', widget: 'string' },
  { name: 'cover', widget: 'image', required: false },
  { name: 'gallery', widget: 'image', multiple: true, required: false },
  { name: 'body', widget: 'markdown', required: false },
];

/**
 * Load a collection keeping each entry’s images beside it, referred to with an absolute path filled
 * with the slug.
 * @param {object} [options] Options.
 * @param {any} [options.i18n] Site-level i18n options. Without them, the collection isn’t
 * localized.
 * @param {string} [options.publicFolder] `public_folder` option.
 * @returns {Promise<any>} Collection.
 */
const loadCollection = async ({ i18n, publicFolder = '/blog/{{slug}}/images' } = {}) => {
  // The configuration is only loaded in a secure context
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });

  await initTestConfig({
    media_folder: 'static/images',
    public_folder: '/images',
    ...(i18n ? { i18n } : {}),
    collections: [
      {
        name: 'posts',
        folder: 'content/posts',
        path: '{{slug}}/index',
        media_folder: 'images',
        public_folder: publicFolder,
        ...(i18n ? { i18n: true } : {}),
        fields: fields.map((field) => (i18n ? { ...field, i18n: true } : field)),
      },
    ],
  });

  return getCollection('posts');
};

/**
 * Make the given files the assets of the collection’s entry-relative folder.
 * @param {string[]} paths Asset paths.
 */
const useAssets = (paths) => {
  const folder = getAssetFolder({ collectionName: 'posts' });

  setAssets(
    paths.map((path) => ({
      path,
      name: path.split('/').pop(),
      sha: path,
      size: 1,
      kind: 'image',
      folder,
    })),
  );
};

/**
 * Create an entry with the given files, keyed by locale.
 * @param {string} slug Slug.
 * @param {Record<string, { path: string, content: any }>} locales Locale files.
 * @returns {any} Entry.
 */
const createEntry = (slug, locales) => ({
  id: 'post',
  slug,
  subPath: `${slug}/index`,
  locales: Object.fromEntries(
    Object.entries(locales).map(([locale, file]) => [locale, { slug, ...file }]),
  ),
});

describe('contents/draft/save/asset-references (integration)', () => {
  beforeEach(() => {
    // The `{{year}}` tag is filled with the time of the save
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-01T00:00:00Z'));
    setAssets([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should rewrite the references to the entry’s own assets after a slug rename', async () => {
    const collection = await loadCollection();

    useAssets([
      'content/posts/hello/images/photo.png',
      'content/posts/hello/images/sub/nested.png',
      'content/posts/world/images/other.png',
    ]);

    const content = {
      title: 'Hello',
      cover: '/blog/hello/images/photo.png',
      'gallery.0': '/blog/hello/images/sub/nested.png',
      'gallery.1': '/blog/world/images/other.png',
      'gallery.2': 'images/photo.png',
      body:
        '![A](/blog/hello/images/photo.png#center) ![B](images/photo.png) ' +
        '![C](/images/global.png) [link](/blog/hello/images/photo.png)\n\n' +
        '<img src="/blog/hello/images/sub/nested.png">',
    };

    const originalEntry = createEntry('hello', {
      _default: { path: 'content/posts/hello/index.md', content },
    });

    const savingEntry = createEntry('bye', {
      _default: { path: 'content/posts/bye/index.md', content: { ...content } },
    });

    const result = await rewriteEntryAssetReferences({ collection, originalEntry, savingEntry });

    expect(result.locales._default.content).toEqual({
      title: 'Hello',
      cover: '/blog/bye/images/photo.png',
      'gallery.0': '/blog/bye/images/sub/nested.png',
      // Another entry’s asset, and a relative reference, are left alone
      'gallery.1': '/blog/world/images/other.png',
      'gallery.2': 'images/photo.png',
      body:
        '![A](/blog/bye/images/photo.png#center) ![B](images/photo.png) ' +
        '![C](/images/global.png) [link](/blog/hello/images/photo.png)\n\n' +
        '<img src="/blog/bye/images/sub/nested.png">',
    });
    // The given entry is left untouched
    expect(savingEntry.locales._default.content).toEqual(content);
  });

  it('should leave a reference filled with the time of saving alone', async () => {
    const collection = await loadCollection({ publicFolder: '/blog/{{year}}/images' });

    useAssets(['content/posts/hello/images/photo.png']);

    const originalEntry = createEntry('hello', {
      _default: {
        path: 'content/posts/hello/index.md',
        content: { title: 'Hello', cover: '/blog/2026/images/photo.png' },
      },
    });

    const savingEntry = createEntry('bye', {
      _default: {
        path: 'content/posts/bye/index.md',
        content: { title: 'Hello', cover: '/blog/2026/images/photo.png' },
      },
    });

    // The tag is filled with the time of the save either way, not a value of the entry
    expect(await rewriteEntryAssetReferences({ collection, originalEntry, savingEntry })).toBe(
      savingEntry,
    );
  });

  it('should leave the entry as is when the public path doesn’t change', async () => {
    const collection = await loadCollection();

    useAssets(['content/posts/hello/images/photo.png']);

    const originalEntry = createEntry('hello', {
      _default: {
        path: 'content/posts/hello/index.md',
        content: { title: 'Hello', cover: '/blog/hello/images/photo.png' },
      },
    });

    const savingEntry = createEntry('hello', {
      _default: {
        path: 'content/posts/hello/index.md',
        content: { title: 'Hi', cover: '/blog/hello/images/photo.png' },
      },
    });

    expect(await rewriteEntryAssetReferences({ collection, originalEntry, savingEntry })).toBe(
      savingEntry,
    );
  });

  it('should leave a relative public path alone', async () => {
    const collection = await loadCollection({ publicFolder: 'images' });

    useAssets(['content/posts/hello/images/photo.png']);

    const originalEntry = createEntry('hello', {
      _default: {
        path: 'content/posts/hello/index.md',
        content: { title: 'Hello', cover: 'images/photo.png' },
      },
    });

    const savingEntry = createEntry('bye', {
      _default: {
        path: 'content/posts/bye/index.md',
        content: { title: 'Hello', cover: 'images/photo.png' },
      },
    });

    expect(await rewriteEntryAssetReferences({ collection, originalEntry, savingEntry })).toBe(
      savingEntry,
    );
  });

  it('should rewrite the references of each locale with its own paths', async () => {
    const collection = await loadCollection({
      i18n: { structure: 'multiple_folders', locales: ['en', 'fr'] },
    });

    useAssets([
      'content/posts/en/hello/images/photo.png',
      'content/posts/fr/hello/images/photo.png',
    ]);

    const originalEntry = createEntry('hello', {
      en: {
        path: 'content/posts/en/hello/index.md',
        content: { title: 'Hello', cover: '/blog/hello/images/photo.png' },
      },
      fr: {
        path: 'content/posts/fr/hello/index.md',
        content: { title: 'Bonjour', cover: '/blog/hello/images/photo.png' },
      },
    });

    const savingEntry = createEntry('bye', {
      en: {
        path: 'content/posts/en/bye/index.md',
        content: { title: 'Hello', cover: '/blog/hello/images/photo.png' },
      },
      fr: {
        path: 'content/posts/fr/bye/index.md',
        content: { title: 'Bonjour', cover: '/blog/hello/images/photo.png' },
      },
      // A locale turned off has no content to rewrite
      de: { path: 'content/posts/de/bye/index.md' },
    });

    const result = await rewriteEntryAssetReferences({ collection, originalEntry, savingEntry });

    expect(result.locales.en.content.cover).toBe('/blog/bye/images/photo.png');
    expect(result.locales.fr.content.cover).toBe('/blog/bye/images/photo.png');
    expect(result.locales.de).toBe(savingEntry.locales.de);
  });
});
