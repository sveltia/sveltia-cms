// @ts-nocheck
import { describe, expect, it } from 'vitest';

import { isPerEntryField } from './per-entry';

describe('entry/per-entry', () => {
  describe('isPerEntryField', () => {
    const collection = { name: 'posts', _type: 'entry' };

    it('should return `true` for a top-level field or an Object subfield of an entry', () => {
      expect(isPerEntryField({ collection, keyPath: 'title' })).toBe(true);
      expect(isPerEntryField({ collection, keyPath: 'book.isbn' })).toBe(true);
    });

    it('should return `false` outside an entry collection', () => {
      expect(isPerEntryField({ collection: { _type: 'file' }, keyPath: 'title' })).toBe(false);
    });

    it('should return `false` for the special index file', () => {
      expect(isPerEntryField({ collection, isIndexFile: true, keyPath: 'title' })).toBe(false);
    });

    it('should return `false` for a field in a rich text editor component', () => {
      expect(isPerEntryField({ collection, keyPath: 'title', inEditorComponent: true })).toBe(
        false,
      );
    });

    it('should return `false` for a field in a List field', () => {
      expect(isPerEntryField({ collection, keyPath: 'speakers.0.name' })).toBe(false);
      expect(isPerEntryField({ collection, keyPath: 'tags.3' })).toBe(false);
      expect(isPerEntryField({ collection, keyPath: 'a.b.12.c' })).toBe(false);
    });
  });
});
