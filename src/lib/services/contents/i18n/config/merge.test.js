import { describe, expect, test } from 'vitest';

import { mergeI18nConfigs } from './merge';

describe('Test mergeI18nConfigs()', () => {
  /** @type {any} */
  const cmsConfigBase = {
    backend: { name: 'github' },
    media_folder: 'static/images/uploads',
  };

  /** @type {any} */
  const cmsConfigWithI18n = {
    ...cmsConfigBase,
    i18n: { structure: 'single_file', locales: ['en', 'fr'] },
  };

  test('should return undefined when the site config is not available', () => {
    const collection = /** @type {any} */ ({ name: 'posts', folder: 'content/posts', fields: [] });

    expect(mergeI18nConfigs({ cmsConfig: undefined, collection })).toBeUndefined();
  });

  test('should return undefined when site config has no i18n', () => {
    const collection = /** @type {any} */ ({ name: 'posts', folder: 'content/posts', fields: [] });

    expect(mergeI18nConfigs({ cmsConfig: cmsConfigBase, collection })).toBeUndefined();
  });

  test('should return undefined when collection has no i18n', () => {
    const collection = /** @type {any} */ ({ name: 'posts', folder: 'content/posts', fields: [] });

    expect(mergeI18nConfigs({ cmsConfig: cmsConfigWithI18n, collection })).toBeUndefined();
  });

  test('should return site i18n config for collection with i18n=true', () => {
    const collection = /** @type {any} */ ({
      name: 'posts',
      folder: 'content/posts',
      fields: [],
      i18n: true,
    });

    expect(mergeI18nConfigs({ cmsConfig: cmsConfigWithI18n, collection })).toEqual({
      structure: 'single_file',
      locales: ['en', 'fr'],
    });
  });

  test('should merge collection i18n config over site config', () => {
    const collection = /** @type {any} */ ({
      name: 'posts',
      folder: 'content/posts',
      fields: [],
      i18n: { structure: 'multiple_folders', locales: ['de', 'es'] },
    });

    expect(mergeI18nConfigs({ cmsConfig: cmsConfigWithI18n, collection })).toEqual({
      structure: 'multiple_folders',
      locales: ['de', 'es'],
    });
  });

  test('should merge file i18n config over collection config', () => {
    const collection = /** @type {any} */ ({
      name: 'pages',
      folder: 'content/pages',
      fields: [],
      i18n: { structure: 'multiple_folders', locales: ['de', 'es'] },
    });

    const file = /** @type {any} */ ({
      name: 'about',
      file: 'data/about.json',
      fields: [],
      i18n: { structure: 'single_file', locales: ['ja'] },
    });

    expect(mergeI18nConfigs({ cmsConfig: cmsConfigWithI18n, collection, file })).toEqual({
      structure: 'single_file',
      locales: ['ja'],
    });
  });

  test('should return the collection config for file with i18n=true', () => {
    const collection = /** @type {any} */ ({ name: 'pages', files: [], i18n: true });
    const file = /** @type {any} */ ({ name: 'about', file: 'data/about.json', i18n: true });

    expect(mergeI18nConfigs({ cmsConfig: cmsConfigWithI18n, collection, file })).toEqual({
      structure: 'single_file',
      locales: ['en', 'fr'],
    });
  });

  test('should return undefined if file has i18n=false', () => {
    const collection = /** @type {any} */ ({ name: 'pages', files: [], i18n: true });
    const file = /** @type {any} */ ({ name: 'about', file: 'data/about.json', i18n: false });

    expect(mergeI18nConfigs({ cmsConfig: cmsConfigWithI18n, collection, file })).toBeUndefined();
  });

  test('should handle singleton collection', () => {
    const collection = /** @type {any} */ ({
      name: '_singletons',
      files: [{ name: 'settings', file: 'data/settings.json', fields: [] }],
    });

    expect(mergeI18nConfigs({ cmsConfig: cmsConfigWithI18n, collection })).toEqual({
      structure: 'single_file',
      locales: ['en', 'fr'],
    });
  });

  test('should not mutate the site config', () => {
    const collection = /** @type {any} */ ({
      name: 'posts',
      folder: 'content/posts',
      fields: [],
      i18n: { locales: ['de'] },
    });

    mergeI18nConfigs({ cmsConfig: cmsConfigWithI18n, collection });

    expect(cmsConfigWithI18n.i18n).toEqual({ structure: 'single_file', locales: ['en', 'fr'] });
  });
});
