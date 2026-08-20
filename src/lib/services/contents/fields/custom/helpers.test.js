import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildPreviewData } from '$lib/services/api/helpers';

import { getFieldConfigMap, getPreviewData } from './helpers';

/** @import { CustomField } from '$lib/types/public'; */

vi.mock('$lib/services/api/helpers', () => ({
  buildPreviewData: vi.fn(({ draft, locale }) => ({ entryMap: { draft, locale } })),
}));

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

  describe('getPreviewData', () => {
    /** @type {any} */
    const draft = { collectionName: 'posts', currentValues: { en: { title: 'Hello' } } };

    beforeEach(() => {
      vi.mocked(buildPreviewData).mockClear();
    });

    it('computes the data once for several fields in the same microtask', () => {
      // Two custom controls and/or previews rendering in response to the same change
      const first = getPreviewData({ draft, locale: 'en' });
      const second = getPreviewData({ draft, locale: 'en' });

      expect(buildPreviewData).toHaveBeenCalledOnce();
      expect(second).toBe(first);
    });

    it('recomputes the data after the microtask, so values never go stale', async () => {
      getPreviewData({ draft, locale: 'en' });

      // The draft is mutated in place, so the cache must not survive the current microtask
      await Promise.resolve();

      getPreviewData({ draft, locale: 'en' });

      expect(buildPreviewData).toHaveBeenCalledTimes(2);
    });

    it('does not share the data between locales', () => {
      getPreviewData({ draft, locale: 'en' });
      getPreviewData({ draft, locale: 'fr' });

      expect(buildPreviewData).toHaveBeenCalledTimes(2);
    });
  });
});
