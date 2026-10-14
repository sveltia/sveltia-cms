import { beforeEach, describe, expect, test } from 'vitest';

import { customPreviewStyleRegistry } from '$lib/services/api/registries';

import { getPreviewStyleURLs } from './preview-styles';

describe('getPreviewStyleURLs()', () => {
  beforeEach(() => {
    customPreviewStyleRegistry.clear();
    customPreviewStyleRegistry.add({ url: 'https://example.com/all.css' });
    customPreviewStyleRegistry.add({ url: 'https://example.com/posts.css', collection: 'posts' });
    customPreviewStyleRegistry.add({ url: 'https://example.com/pages.css', collection: 'pages' });
    customPreviewStyleRegistry.add({
      url: 'https://example.com/about.css',
      collection: 'pages',
      file: 'about',
    });
    customPreviewStyleRegistry.add({
      url: 'https://example.com/home.css',
      collection: '_singletons',
      file: 'home',
    });
  });

  test('returns nothing when no styles are registered', () => {
    customPreviewStyleRegistry.clear();
    expect(getPreviewStyleURLs({ collectionName: 'posts' })).toEqual([]);
  });

  test('returns the global and collection styles for an entry collection', () => {
    expect(getPreviewStyleURLs({ collectionName: 'posts' })).toEqual([
      'https://example.com/all.css',
      'https://example.com/posts.css',
    ]);
  });

  test('returns the global, collection and file styles for a file collection', () => {
    expect(getPreviewStyleURLs({ collectionName: 'pages', fileName: 'about' })).toEqual([
      'https://example.com/all.css',
      'https://example.com/pages.css',
      'https://example.com/about.css',
    ]);
    expect(getPreviewStyleURLs({ collectionName: 'pages', fileName: 'contact' })).toEqual([
      'https://example.com/all.css',
      'https://example.com/pages.css',
    ]);
  });

  test('returns the styles for a singleton', () => {
    expect(getPreviewStyleURLs({ collectionName: '_singletons', fileName: 'home' })).toEqual([
      'https://example.com/all.css',
      'https://example.com/home.css',
    ]);
  });

  test('returns only the global styles without a collection', () => {
    expect(getPreviewStyleURLs({})).toEqual(['https://example.com/all.css']);
  });

  test('removes duplicate URLs', () => {
    customPreviewStyleRegistry.add({ url: 'https://example.com/all.css', collection: 'posts' });
    expect(getPreviewStyleURLs({ collectionName: 'posts' })).toEqual([
      'https://example.com/all.css',
      'https://example.com/posts.css',
    ]);
  });
});
