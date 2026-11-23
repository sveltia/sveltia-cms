// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isCollectionIndexFile } from '$lib/services/contents/collection/entries/index-file';
import { getOtherEntries } from '$lib/services/contents/draft/validate/slugs';
import { isFieldMultiple } from '$lib/services/contents/entry/fields';

import { isUniqueField, isValueTaken, normalizeUniqueValue } from './unique';

vi.mock('$lib/services/contents/collection/entries/index-file', () => ({
  isCollectionIndexFile: vi.fn(() => false),
}));
vi.mock('$lib/services/contents/draft/validate/slugs', () => ({
  getOtherEntries: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/entry/fields', () => ({
  isFieldMultiple: vi.fn(() => false),
}));

/**
 * Create an entry.
 * @param {string} id Entry ID.
 * @param {Record<string, Record<string, any>>} contents Flattened content for each locale.
 * @returns {any} Entry.
 */
const createEntry = (id, contents) => ({
  id,
  slug: id,
  locales: Object.fromEntries(
    Object.entries(contents).map(([locale, content]) => [
      locale,
      { slug: id, path: `content/posts/${id}.${locale}.md`, content },
    ]),
  ),
});

describe('draft/validate/unique', () => {
  let draft;

  beforeEach(() => {
    vi.mocked(getOtherEntries).mockReturnValue([]);
    vi.mocked(isCollectionIndexFile).mockReturnValue(false);
    vi.mocked(isFieldMultiple).mockReturnValue(false);

    draft = {
      collection: { name: 'posts', _type: 'entry' },
      collectionName: 'posts',
      isIndexFile: false,
    };
  });

  describe('normalizeUniqueValue', () => {
    it('should trim a string', () => {
      expect(normalizeUniqueValue('  Hello  ', 'string')).toBe('Hello');
      expect(normalizeUniqueValue('Line 1\nLine 2\n', 'text')).toBe('Line 1\nLine 2');
    });

    it('should keep the case of a string', () => {
      expect(normalizeUniqueValue('Hello', 'string')).not.toBe(
        normalizeUniqueValue('hello', 'string'),
      );
    });

    it('should convert a number to a string in a String field', () => {
      expect(normalizeUniqueValue(42, 'string')).toBe('42');
    });

    it('should compare a Number field by its numeric value', () => {
      expect(normalizeUniqueValue(1, 'number')).toBe(1);
      expect(normalizeUniqueValue('1', 'number')).toBe(1);
      expect(normalizeUniqueValue(' 01 ', 'number')).toBe(1);
      expect(normalizeUniqueValue('1.50', 'number')).toBe(1.5);
    });

    it('should return `undefined` for a value that isn’t a number in a Number field', () => {
      expect(normalizeUniqueValue('abc', 'number')).toBeUndefined();
      expect(normalizeUniqueValue(Infinity, 'number')).toBeUndefined();
    });

    it('should compare a Color field regardless of case', () => {
      expect(normalizeUniqueValue(' #FF00AA ', 'color')).toBe('#ff00aa');
      expect(normalizeUniqueValue('#ff00aa', 'color')).toBe('#ff00aa');
    });

    it('should keep the case of a value in another field type', () => {
      expect(normalizeUniqueValue('Posts/A', 'relation')).toBe('Posts/A');
      expect(normalizeUniqueValue('/uploads/A.jpg', 'image')).toBe('/uploads/A.jpg');
    });

    it('should convert a Select field value that isn’t a string to a string', () => {
      expect(normalizeUniqueValue(3, 'select')).toBe('3');
      expect(normalizeUniqueValue(true, 'select')).toBe('true');
      expect(normalizeUniqueValue(false, 'select')).toBe('false');
    });

    it('should return `undefined` for a file just uploaded to a File or Image field', () => {
      expect(normalizeUniqueValue('blob:https://example.com/1234', 'file')).toBeUndefined();
      expect(normalizeUniqueValue('blob:https://example.com/1234', 'image')).toBeUndefined();
      expect(normalizeUniqueValue('blob:https://example.com/1234', 'string')).toBe(
        'blob:https://example.com/1234',
      );
    });

    it('should return `undefined` for an empty value', () => {
      expect(normalizeUniqueValue(undefined, 'string')).toBeUndefined();
      expect(normalizeUniqueValue(null, 'number')).toBeUndefined();
      expect(normalizeUniqueValue('', 'string')).toBeUndefined();
      expect(normalizeUniqueValue('   ', 'text')).toBeUndefined();
    });

    it('should return `undefined` for an object or an array', () => {
      expect(normalizeUniqueValue({ a: 1 }, 'string')).toBeUndefined();
      expect(normalizeUniqueValue(['a'], 'string')).toBeUndefined();
    });
  });

  describe('isUniqueField', () => {
    /**
     * Call `isUniqueField` with the given field and options.
     * @param {object} fieldConfig Field configuration.
     * @param {object} [args] Other arguments.
     * @returns {boolean} Result.
     */
    const check = (fieldConfig, args = {}) =>
      isUniqueField({ draft, fieldConfig, keyPath: 'title', ...args });

    it('should return `true` for a String, Text or Number field with `unique: true`', () => {
      expect(check({ name: 'title', unique: true })).toBe(true);
      expect(check({ name: 'title', widget: 'string', unique: true })).toBe(true);
      expect(check({ name: 'title', widget: 'text', unique: true })).toBe(true);
      expect(check({ name: 'title', widget: 'number', unique: true })).toBe(true);
    });

    it('should return `true` for another supported field type with `unique: true`', () => {
      ['color', 'datetime', 'file', 'image', 'markdown', 'relation', 'richtext', 'select'].forEach(
        (widget) => {
          expect(check({ name: 'title', widget, unique: true })).toBe(true);
        },
      );
    });

    it('should return `false` for a field that takes multiple values', () => {
      const fieldConfig = { name: 'tags', widget: 'select', multiple: true, unique: true };

      vi.mocked(isFieldMultiple).mockReturnValue(true);

      expect(check(fieldConfig)).toBe(false);
      expect(isFieldMultiple).toHaveBeenCalledWith(fieldConfig);
    });

    it('should return `false` without `unique: true`', () => {
      expect(check({ name: 'title' })).toBe(false);
      expect(check({ name: 'title', unique: false })).toBe(false);
      expect(check({ name: 'title', unique: 'yes' })).toBe(false);
    });

    it('should return `false` for an unsupported field type', () => {
      expect(check({ name: 'title', widget: 'boolean', unique: true })).toBe(false);
      expect(check({ name: 'title', widget: 'uuid', unique: true })).toBe(false);
      expect(check({ name: 'title', widget: 'code', unique: true })).toBe(false);
    });

    it('should return `false` outside an entry collection', () => {
      draft.collection._type = 'file';

      expect(check({ name: 'title', unique: true })).toBe(false);
    });

    it('should return `false` for the special index file', () => {
      draft.isIndexFile = true;

      expect(check({ name: 'title', unique: true })).toBe(false);
    });

    it('should return `false` for a field in a rich text editor component', () => {
      expect(check({ name: 'title', unique: true }, { componentName: 'image' })).toBe(false);
    });

    it('should return `false` for a field in a List field', () => {
      expect(check({ name: 'name', unique: true }, { keyPath: 'speakers.0.name' })).toBe(false);
      expect(check({ name: 'tags', unique: true }, { keyPath: 'tags.3' })).toBe(false);
    });

    it('should return `true` for a field in an Object field', () => {
      expect(check({ name: 'isbn', unique: true }, { keyPath: 'book.isbn' })).toBe(true);
    });
  });

  describe('isValueTaken', () => {
    /**
     * Call `isValueTaken` with the given value and options.
     * @param {any} value Value.
     * @param {object} [args] Other arguments.
     * @returns {boolean} Result.
     */
    const check = (value, args = {}) =>
      isValueTaken({ draft, locale: 'en', keyPath: 'title', value, fieldType: 'string', ...args });

    it('should return `false` when no other entry exists', () => {
      expect(check('Hello')).toBe(false);
    });

    it('should look at the entries the collection lists, not every entry in its folder', () => {
      check('Hello');

      expect(getOtherEntries).toHaveBeenCalledWith(draft, { inFolder: false });
    });

    it('should return `true` when another entry has the same value', () => {
      vi.mocked(getOtherEntries).mockReturnValue([
        createEntry('a', { en: { title: 'Bye' } }),
        createEntry('b', { en: { title: 'Hello' } }),
      ]);

      expect(check('Hello')).toBe(true);
      expect(check('  Hello ')).toBe(true);
      expect(check('Hi')).toBe(false);
      expect(check('hello')).toBe(false);
    });

    it('should compare the value at the same key path only', () => {
      vi.mocked(getOtherEntries).mockReturnValue([
        createEntry('a', { en: { title: 'Bye', 'book.title': 'Hello' } }),
      ]);

      expect(check('Hello')).toBe(false);
      expect(check('Hello', { keyPath: 'book.title' })).toBe(true);
    });

    it('should compare the value in the same locale only', () => {
      vi.mocked(getOtherEntries).mockReturnValue([
        createEntry('a', { en: { title: 'Hello' }, fr: { title: 'Bonjour' } }),
        createEntry('b', { ja: { title: 'Hello' } }),
      ]);

      expect(check('Bonjour')).toBe(false);
      expect(check('Bonjour', { locale: 'fr' })).toBe(true);
      expect(check('Hello', { locale: 'fr' })).toBe(false);
      expect(check('Hello', { locale: 'de' })).toBe(false);
    });

    it('should compare a Number field by its numeric value', () => {
      vi.mocked(getOtherEntries).mockReturnValue([
        createEntry('a', { en: { order: 1 } }),
        createEntry('b', { en: { order: '2' } }),
      ]);

      const args = { keyPath: 'order', fieldType: 'number' };

      expect(check('1', args)).toBe(true);
      expect(check(2, args)).toBe(true);
      expect(check(3, args)).toBe(false);
    });

    it('should compare a Color field regardless of case', () => {
      vi.mocked(getOtherEntries).mockReturnValue([createEntry('a', { en: { color: '#FF0000' } })]);

      expect(check('#ff0000', { keyPath: 'color', fieldType: 'color' })).toBe(true);
    });

    it('should compare a File or Image field by its path', () => {
      vi.mocked(getOtherEntries).mockReturnValue([
        createEntry('a', { en: { cover: '/uploads/a.jpg' } }),
      ]);

      const args = { keyPath: 'cover', fieldType: 'image' };

      expect(check('/uploads/a.jpg', args)).toBe(true);
      expect(check('/uploads/b.jpg', args)).toBe(false);
      expect(check('blob:https://example.com/1234', args)).toBe(false);
    });

    it('should never report an empty value as a duplicate', () => {
      vi.mocked(getOtherEntries).mockReturnValue([
        createEntry('a', { en: { title: '' } }),
        createEntry('b', { en: {} }),
      ]);

      expect(check('')).toBe(false);
      expect(check(undefined)).toBe(false);
      expect(getOtherEntries).not.toHaveBeenCalled();
    });

    it('should leave out the special index file', () => {
      const indexFile = createEntry('_index', { en: { title: 'Hello' } });

      vi.mocked(getOtherEntries).mockReturnValue([indexFile]);
      vi.mocked(isCollectionIndexFile).mockImplementation(
        (_collection, entry) => entry === indexFile,
      );

      expect(check('Hello')).toBe(false);
      expect(isCollectionIndexFile).toHaveBeenCalledWith(draft.collection, indexFile);
    });
  });
});
