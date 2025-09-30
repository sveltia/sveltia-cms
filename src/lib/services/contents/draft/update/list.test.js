// @ts-nocheck
/* eslint-disable jsdoc/require-jsdoc */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';

import { updateListField } from './list';

vi.mock('$lib/services/contents/draft');
vi.mock('$lib/services/user/prefs', () => ({
  prefs: { subscribe: vi.fn(() => vi.fn()) },
}));
vi.mock('svelte/store', async () => {
  const actual = await vi.importActual('svelte/store');

  return {
    ...actual,
    get: vi.fn(() => ({ devModeEnabled: false })),
  };
});

describe('draft/update/list', () => {
  let mockEntryDraft;
  let mockUpdate;
  let mockGet;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { get } = await import('svelte/store');

    mockGet = vi.mocked(get);

    mockEntryDraft = {
      collection: {
        _i18n: { defaultLocale: 'en' },
      },
      collectionFile: undefined,
      currentValues: {
        en: {
          'tags.0': 'tag1',
          'tags.1': 'tag2',
          'tags.2': 'tag3',
        },
      },
      expanderStates: {
        _: {
          'tags.0': true,
          'tags.1': false,
          'tags.2': true,
        },
      },
    };

    mockUpdate = vi.fn((fn) => {
      if (typeof fn === 'function') {
        return fn(mockEntryDraft);
      }

      return mockEntryDraft;
    });

    mockGet.mockImplementation((store) => {
      if (store === entryDraft) {
        return mockEntryDraft;
      }

      return undefined;
    });

    vi.mocked(entryDraft).update = mockUpdate;

    vi.mocked(i18nAutoDupEnabled).set = vi.fn();
  });

  describe('updateListField', () => {
    it('should add item to list', () => {
      updateListField({
        locale: 'en',
        keyPath: 'tags',
        manipulate: ({ valueList }) => {
          valueList.push('tag4');
        },
      });

      expect(mockUpdate).toHaveBeenCalled();
      expect(vi.mocked(i18nAutoDupEnabled).set).toHaveBeenCalledWith(false);
      expect(vi.mocked(i18nAutoDupEnabled).set).toHaveBeenCalledWith(true);
    });

    it('should remove item from list', () => {
      updateListField({
        locale: 'en',
        keyPath: 'tags',
        manipulate: ({ valueList }) => {
          valueList.splice(1, 1);
        },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should reorder items in list', () => {
      updateListField({
        locale: 'en',
        keyPath: 'tags',
        manipulate: ({ valueList }) => {
          const [first] = valueList.splice(0, 1);

          valueList.push(first);
        },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should handle expander states for default locale', () => {
      updateListField({
        locale: 'en',
        keyPath: 'tags',
        manipulate: ({ valueList, expanderStateList }) => {
          valueList.push('tag4');
          expanderStateList.push(false);
        },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should not manipulate expander states for non-default locale', () => {
      mockEntryDraft.currentValues.ja = {
        'tags.0': 'タグ1',
        'tags.1': 'タグ2',
      };

      updateListField({
        locale: 'ja',
        keyPath: 'tags',
        manipulate: ({ valueList, expanderStateList }) => {
          valueList.push('タグ3');
          expect(expanderStateList).toEqual([]);
        },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should support custom valueStoreKey', () => {
      mockEntryDraft.originalValues = {
        en: {
          'tags.0': 'original1',
          'tags.1': 'original2',
        },
      };

      updateListField({
        locale: 'en',
        valueStoreKey: 'originalValues',
        keyPath: 'tags',
        manipulate: ({ valueList }) => {
          valueList.push('original3');
        },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should handle empty list', () => {
      mockEntryDraft.currentValues.en = {};

      updateListField({
        locale: 'en',
        keyPath: 'tags',
        manipulate: ({ valueList }) => {
          expect(valueList).toEqual([]);
          valueList.push('tag1');
        },
      });

      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should disable and re-enable i18nAutoDup', () => {
      const mockSet = vi.mocked(i18nAutoDupEnabled).set;

      updateListField({
        locale: 'en',
        keyPath: 'tags',
        manipulate: () => {},
      });

      expect(mockSet).toHaveBeenNthCalledWith(1, false);
      expect(mockSet).toHaveBeenNthCalledWith(2, true);
    });
  });
});
