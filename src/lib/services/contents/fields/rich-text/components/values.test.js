import { describe, expect, test } from 'vitest';

import {
  deleteKeysByPrefix,
  flattenWithPrefix,
} from '$lib/services/contents/fields/rich-text/components/values';

describe('contents/fields/rich-text/components/values', () => {
  describe('deleteKeysByPrefix()', () => {
    test('removes the keys starting with the prefix in place', () => {
      const valueMap = {
        title: 'Title',
        'body:c1:src': 'a.jpg',
        'body:c1:alt': 'A',
        'body:c2:src': 'b.jpg',
      };

      deleteKeysByPrefix(valueMap, 'body:c1:');

      expect(valueMap).toEqual({ title: 'Title', 'body:c2:src': 'b.jpg' });
    });

    test('does nothing without a map', () => {
      expect(() => deleteKeysByPrefix(undefined, 'body:c1:')).not.toThrow();
    });
  });

  describe('flattenWithPrefix()', () => {
    test('flattens the values and prefixes the keys', () => {
      expect(
        flattenWithPrefix({ src: 'a.jpg', meta: { alt: 'A' }, tags: ['x'] }, 'body:c1:'),
      ).toEqual({
        'body:c1:src': 'a.jpg',
        'body:c1:meta.alt': 'A',
        'body:c1:tags.0': 'x',
      });
    });
  });
});
