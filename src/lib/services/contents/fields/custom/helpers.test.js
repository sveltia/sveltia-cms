import { describe, expect, it } from 'vitest';

import { getFieldConfigMap } from './helpers';

/** @import { CustomField } from '$lib/types/public'; */

describe('contents/fields/custom/helpers', () => {
  describe('getFieldConfigMap', () => {
    it('converts a field configuration to an Immutable Map', () => {
      /** @type {any} */
      const fieldConfig = { name: 'rating', widget: 'star-rating', max: 5 };
      const map = getFieldConfigMap(fieldConfig);

      expect(map.get('name')).toBe('rating');
      expect(map.get('widget')).toBe('star-rating');
      expect(map.get('max')).toBe(5);
    });

    it('returns the same reference for the same configuration object', () => {
      /** @type {any} */
      const fieldConfig = { name: 'rating', widget: 'star-rating' };

      // A stable reference lets `React.memo()` in custom widgets skip re-renders
      expect(getFieldConfigMap(fieldConfig)).toBe(getFieldConfigMap(fieldConfig));
    });

    it('returns different Maps for different configuration objects', () => {
      /** @type {any} */
      const a = { name: 'one', widget: 'star-rating' };
      /** @type {any} */
      const b = { name: 'two', widget: 'star-rating' };

      expect(getFieldConfigMap(a)).not.toBe(getFieldConfigMap(b));
      expect(getFieldConfigMap(a).get('name')).toBe('one');
      expect(getFieldConfigMap(b).get('name')).toBe('two');
    });

    it('converts nested configuration values to Immutable collections', () => {
      /** @type {any} */
      const fieldConfig = { name: 'select', widget: 'custom', options: ['a', 'b'] };
      const map = getFieldConfigMap(fieldConfig);

      expect(map.get('options').toJS()).toEqual(['a', 'b']);
    });
  });
});
