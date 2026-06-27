import { isMap } from 'immutable';
import { describe, expect, it } from 'vitest';

import { createEntryMap } from './entries';

/**
 * Tests use simplified test objects that don't match full type definitions.
 * Type errors are suppressed below as they are expected for unit test mocks.
 */
describe('entry module', () => {
  describe('createEntryMap', () => {
    const baseArgs = {
      content: { title: 'Hello', 'author.name': 'Jane' },
      otherLocales: [],
      locales: {
        en: {
          slug: 'hello',
          content: { title: 'Hello', 'author.name': 'Jane' },
          path: 'posts/hello.md',
        },
      },
      slug: 'hello',
      path: 'posts/hello.md',
      isNew: false,
      collectionName: 'posts',
      associatedAssets: [],
    };

    it('should return an Immutable Map', () => {
      expect(isMap(createEntryMap(baseArgs))).toBe(true);
    });

    it('should unflatten content into data', () => {
      const map = createEntryMap(baseArgs);
      const data = map.get('data');

      expect(data.get('title')).toBe('Hello');
      expect(data.getIn(['author', 'name'])).toBe('Jane');
    });

    it('should set i18n to empty map when no other locales', () => {
      const map = createEntryMap(baseArgs);

      expect(isMap(map.get('i18n'))).toBe(true);
      expect(map.get('i18n').size).toBe(0);
    });

    it('should include unflattened content for each other locale in i18n', () => {
      const map = createEntryMap({
        ...baseArgs,
        otherLocales: ['ja', 'fr'],
        locales: {
          en: { slug: 'hello', content: { title: 'Hello' }, path: 'posts/hello.md' },
          ja: {
            slug: 'hello',
            content: { title: 'こんにちは', 'author.name': '田中' },
            path: 'posts/hello.ja.md',
          },
          fr: { slug: 'hello', content: { title: 'Bonjour' }, path: 'posts/hello.fr.md' },
        },
      });

      const i18n = map.get('i18n');

      expect(i18n.getIn(['ja', 'data', 'title'])).toBe('こんにちは');
      expect(i18n.getIn(['ja', 'data', 'author', 'name'])).toBe('田中');
      expect(i18n.getIn(['fr', 'data', 'title'])).toBe('Bonjour');
      expect(i18n.get('en')).toBeUndefined();
    });

    it('should set slug, path, collection and newRecord', () => {
      const map = createEntryMap({
        ...baseArgs,
        slug: 'my-slug',
        path: 'a/b.md',
        isNew: true,
        collectionName: 'blog',
      });

      expect(map.get('slug')).toBe('my-slug');
      expect(map.get('path')).toBe('a/b.md');
      expect(map.get('collection')).toBe('blog');
      expect(map.get('newRecord')).toBe(true);
    });

    it('should map associated assets to mediaFiles', () => {
      const assets = [
        {
          sha: 'abc123',
          file: new File(['x'], 'img.jpg'),
          size: 512,
          blobURL: 'blob:http://localhost/1',
          name: 'img.jpg',
          path: '/images/img.jpg',
        },
      ];

      const map = createEntryMap({ ...baseArgs, associatedAssets: /** @type {any} */ (assets) });
      const mediaFiles = /** @type {any} */ (map.get('mediaFiles'));

      expect(mediaFiles.size).toBe(1);

      const file = mediaFiles.get(0);

      expect(file.get('id')).toBe('abc123');
      expect(file.get('name')).toBe('img.jpg');
      expect(file.get('path')).toBe('/images/img.jpg');
      expect(file.get('size')).toBe(512);
      expect(file.get('url')).toBe('blob:http://localhost/1');
      expect(file.get('displayURL')).toBe('blob:http://localhost/1');
    });

    it('should set meta.path to the entry path', () => {
      const map = createEntryMap({ ...baseArgs, path: 'content/page.md' });

      expect(map.getIn(['meta', 'path'])).toBe('content/page.md');
    });

    it('should include Netlify/Decap CMS compatibility properties with fixed values', () => {
      const map = createEntryMap(baseArgs);

      expect(map.get('isModification')).toBeNull();
      expect(map.get('label')).toBeNull();
      expect(map.get('partial')).toBe(false);
      expect(map.get('author')).toBe('');
      expect(map.get('raw')).toBe('');
      expect(map.get('status')).toBe('');
      expect(map.get('updatedOn')).toBe('');
    });

    it('should handle empty content', () => {
      const map = createEntryMap({
        ...baseArgs,
        content: {},
        locales: { en: { slug: 'hello', content: {}, path: 'posts/hello.md' } },
      });

      expect(isMap(map.get('data'))).toBe(true);
      expect(map.get('data').size).toBe(0);
    });
  });
});
