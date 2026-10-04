import { describe, expect, test } from 'vitest';

import {
  deleteKeysByPrefix,
  flattenWithPrefix,
  getValuesByPrefix,
  reconcileComponentValues,
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

  describe('getValuesByPrefix()', () => {
    test('returns the values of the component without the prefix', () => {
      expect(
        getValuesByPrefix(
          {
            title: 'Title',
            'body:c1:src': 'a.jpg',
            'body:c1:tags.0': 'x',
            'body:c1:tags.1': 'y',
            'body:c2:src': 'b.jpg',
          },
          'body:c1:',
        ),
      ).toEqual({ src: 'a.jpg', tags: ['x', 'y'] });
    });

    test('returns an empty object when the component has no values', () => {
      expect(getValuesByPrefix({ title: 'Title' }, 'body:c1:')).toEqual({});
    });
  });

  describe('reconcileComponentValues()', () => {
    /** @type {import('$lib/types/public').Field[]} */
    const fields = [
      { name: 'src', widget: 'string', default: 'default.jpg' },
      { name: 'alt', widget: 'string' },
    ];

    const args = { fields, componentName: 'image', locale: '_default', defaultLocale: '_default' };

    test('gives a new component the default values', () => {
      expect(reconcileComponentValues({ ...args, values: undefined })).toEqual({
        src: 'default.jpg',
        alt: '',
        __sc_component_name: 'image',
      });
    });

    test('keeps the values as they are when nothing has changed', () => {
      const values = { src: 'a.jpg', alt: 'A' };
      const result = reconcileComponentValues({ ...args, values });

      expect(result).toBe(values);
      // The component name is added in place
      expect(values).toEqual({ src: 'a.jpg', alt: 'A', __sc_component_name: 'image' });
    });

    test('reconciles a value that doesn’t match the field', () => {
      const values = { src: 'a.jpg', count: '5' };

      const result = reconcileComponentValues({
        ...args,
        fields: [...fields, { name: 'count', widget: 'number' }],
        values,
      });

      expect(result).not.toBe(values);
      expect(result).toEqual({ src: 'a.jpg', count: 5, __sc_component_name: 'image' });
    });

    test('doesn’t fill in missing values', () => {
      const values = { src: 'a.jpg' };

      expect(reconcileComponentValues({ ...args, values })).toBe(values);
    });
  });
});
