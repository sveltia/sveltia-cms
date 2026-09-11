// @ts-nocheck
/* eslint-disable jsdoc/require-jsdoc */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  moveMultiValueItem as _moveMultiValueItem,
  removeMultiValueItem as _removeMultiValueItem,
  updateListField as _updateListField,
  getItemList,
  updateObject,
} from './list';

const { suspendAutoDuplication } = vi.hoisted(() => ({
  suspendAutoDuplication: vi.fn((fn) => fn()),
}));

vi.mock('$lib/services/contents/draft', () => ({ suspendAutoDuplication }));

describe('draft/update/list', () => {
  let mockEntryDraft;
  const updateListField = (args) => _updateListField({ draft: mockEntryDraft, ...args });
  const moveMultiValueItem = (args) => _moveMultiValueItem({ draft: mockEntryDraft, ...args });
  const removeMultiValueItem = (args) => _removeMultiValueItem({ draft: mockEntryDraft, ...args });

  beforeEach(async () => {
    vi.clearAllMocks();

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

      expect(mockEntryDraft.currentValues.en['tags.3']).toBe('tag4');
      expect(suspendAutoDuplication).toHaveBeenCalled();
    });

    // https://github.com/sveltia/sveltia-cms/issues/939
    it('should accumulate items across consecutive updates to the same value map', () => {
      mockEntryDraft.currentValues.en = {};
      mockEntryDraft.expanderStates._ = {};

      ['tag1', 'tag2', 'tag3'].forEach((value) => {
        updateListField({
          locale: 'en',
          keyPath: 'tags',
          manipulate: ({ valueList }) => {
            valueList.push(value);
          },
        });
      });

      expect(mockEntryDraft.currentValues.en).toEqual({
        'tags.0': 'tag1',
        'tags.1': 'tag2',
        'tags.2': 'tag3',
      });
    });

    it('should remove item from list', () => {
      updateListField({
        locale: 'en',
        keyPath: 'tags',
        manipulate: ({ valueList }) => {
          valueList.splice(1, 1);
        },
      });
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
    });

    it('should write with the automatic i18n duplication suspended', () => {
      updateListField({
        locale: 'en',
        keyPath: 'tags',
        manipulate: () => {},
      });

      expect(suspendAutoDuplication).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateObject (internal)', () => {
    it('should add new properties', () => {
      const obj = { a: 1, b: 2 };
      const newProps = { a: 1, b: 2, c: 3 };

      updateObject(obj, newProps);

      expect(obj).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('should update existing properties', () => {
      const obj = { a: 1, b: 2 };
      const newProps = { a: 10, b: 20 };

      updateObject(obj, newProps);

      expect(obj).toEqual({ a: 10, b: 20 });
    });

    it('should delete properties not in newProps', () => {
      const obj = { a: 1, b: 2, c: 3 };
      const newProps = { a: 1 };

      updateObject(obj, newProps);

      expect(obj).toEqual({ a: 1 });
      expect(obj).not.toHaveProperty('b');
      expect(obj).not.toHaveProperty('c');
    });

    it('should handle empty newProps', () => {
      const obj = { a: 1, b: 2 };
      const newProps = {};

      updateObject(obj, newProps);

      expect(obj).toEqual({});
    });

    it('should not update when values are the same', () => {
      const obj = { a: 1, b: 2 };
      const newProps = { a: 1, b: 2 };
      const originalObj = { ...obj };

      updateObject(obj, newProps);

      expect(obj).toEqual(originalObj);
    });
  });

  describe('getItemList (internal)', () => {
    it('should extract list items from flattened object', () => {
      const obj = {
        'tags.0': 'tag1',
        'tags.1': 'tag2',
        'tags.2': 'tag3',
        other: 'value',
      };

      const [valueList, remainder] = getItemList(obj, 'tags');

      expect(valueList).toEqual(['tag1', 'tag2', 'tag3']);
      expect(remainder).toEqual({ other: 'value' });
    });

    it('should return empty array for non-existent key path', () => {
      const obj = {
        'tags.0': 'tag1',
        other: 'value',
      };

      const [valueList, remainder] = getItemList(obj, 'nonexistent');

      expect(valueList).toEqual([]);
      expect(remainder).toEqual({
        'tags.0': 'tag1',
        other: 'value',
      });
    });

    it('should handle nested list items', () => {
      const obj = {
        'items.0.name': 'Item 1',
        'items.0.value': 10,
        'items.1.name': 'Item 2',
        'items.1.value': 20,
        other: 'value',
      };

      const [valueList, remainder] = getItemList(obj, 'items');

      expect(valueList).toEqual([
        { name: 'Item 1', value: 10 },
        { name: 'Item 2', value: 20 },
      ]);
      expect(remainder).toEqual({ other: 'value' });
    });

    it('should preserve sort order', () => {
      const obj = {
        'tags.2': 'tag3',
        'tags.0': 'tag1',
        'tags.1': 'tag2',
      };

      const [valueList] = getItemList(obj, 'tags');

      expect(valueList).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should not match keyPaths with # suffix', () => {
      const obj = {
        'tags.0': 'tag1',
        'tags.1': 'tag2',
        'tags#metadata': 'should not match',
      };

      const [valueList, remainder] = getItemList(obj, 'tags');

      expect(valueList).toEqual(['tag1', 'tag2']);
      expect(remainder).toEqual({ 'tags#metadata': 'should not match' });
    });

    it('should reuse the cached regex when called twice with the same key path', () => {
      // Calling getItemList twice with the same keyPath exercises the itemListRegexCache hit path.
      const obj = { 'items.0': 'a', 'items.1': 'b', other: 'x' };
      const [list1] = getItemList(obj, 'items');
      const [list2] = getItemList(obj, 'items');

      expect(list1).toEqual(['a', 'b']);
      expect(list2).toEqual(['a', 'b']);
    });
  });

  describe('moveMultiValueItem', () => {
    beforeEach(() => {
      mockEntryDraft.currentValues.en = {
        title: 'Hello',
        'blocks.0.photos.0': 'a.png',
        'blocks.0.photos.1': 'b.png',
        'blocks.0.photos.2': 'c.png',
        'blocks.0.photos.3': 'd.png',
      };
    });

    /**
     * Get the item values in list order.
     * @param {string} [valueStoreKey] Value store key.
     * @param {string} [keyPath] Dot-notated field name.
     * @returns {any[]} Values.
     */
    const items = (valueStoreKey = 'currentValues', keyPath = 'blocks.0.photos') =>
      Object.entries(mockEntryDraft[valueStoreKey].en)
        .filter(([key]) => key.startsWith(`${keyPath}.`))
        .map(([, value]) => value);

    it('should move an item down', () => {
      moveMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', from: 0, to: 2 });

      expect(items()).toEqual(['b.png', 'c.png', 'a.png', 'd.png']);
    });

    it('should move an item up', () => {
      moveMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', from: 3, to: 1 });

      expect(items()).toEqual(['a.png', 'd.png', 'b.png', 'c.png']);
    });

    it('should move an item to either end', () => {
      moveMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', from: 2, to: 0 });
      expect(items()).toEqual(['c.png', 'a.png', 'b.png', 'd.png']);

      moveMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', from: 0, to: 3 });
      expect(items()).toEqual(['a.png', 'b.png', 'd.png', 'c.png']);
    });

    it('should leave the other values alone', () => {
      moveMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', from: 0, to: 1 });

      expect(mockEntryDraft.currentValues.en.title).toBe('Hello');
      expect(Object.keys(mockEntryDraft.currentValues.en)).toHaveLength(5);
    });

    it('should do nothing when the source and destination are the same', () => {
      moveMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', from: 1, to: 1 });

      expect(items()).toEqual(['a.png', 'b.png', 'c.png', 'd.png']);
    });

    it('should do nothing when either index is out of range', () => {
      moveMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', from: 4, to: 0 });
      moveMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', from: 0, to: 4 });
      moveMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', from: -1, to: 0 });

      expect(items()).toEqual(['a.png', 'b.png', 'c.png', 'd.png']);
    });

    it('should do nothing for an unknown field', () => {
      moveMultiValueItem({ locale: 'en', keyPath: 'blocks.0.videos', from: 0, to: 1 });

      expect(items()).toEqual(['a.png', 'b.png', 'c.png', 'd.png']);
    });

    it('should support a custom value store key', () => {
      mockEntryDraft.extraValues = {
        en: { 'photos.0': 'a.png', 'photos.1': 'b.png' },
      };

      moveMultiValueItem({
        locale: 'en',
        valueStoreKey: 'extraValues',
        keyPath: 'photos',
        from: 0,
        to: 1,
      });

      expect(items('extraValues', 'photos')).toEqual(['b.png', 'a.png']);
      // The other value store must be left alone
      expect(items()).toEqual(['a.png', 'b.png', 'c.png', 'd.png']);
    });

    it('should not return the updated list', () => {
      expect(
        moveMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', from: 0, to: 1 }),
      ).toBeUndefined();
    });
  });

  describe('removeMultiValueItem', () => {
    beforeEach(() => {
      mockEntryDraft.currentValues.en = {
        title: 'Hello',
        'blocks.0.photos.0': 'a.png',
        'blocks.0.photos.1': 'b.png',
        'blocks.0.photos.2': 'c.png',
        'blocks.0.photos.3': 'd.png',
      };
    });

    it('should remove the first item and shift the rest', () => {
      removeMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', index: 0 });

      expect(mockEntryDraft.currentValues.en).toEqual({
        title: 'Hello',
        'blocks.0.photos.0': 'b.png',
        'blocks.0.photos.1': 'c.png',
        'blocks.0.photos.2': 'd.png',
      });
    });

    it('should remove an item in the middle', () => {
      removeMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', index: 1 });

      expect(mockEntryDraft.currentValues.en).toEqual({
        title: 'Hello',
        'blocks.0.photos.0': 'a.png',
        'blocks.0.photos.1': 'c.png',
        'blocks.0.photos.2': 'd.png',
      });
    });

    it('should remove the last item', () => {
      removeMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', index: 3 });

      expect(mockEntryDraft.currentValues.en).toEqual({
        title: 'Hello',
        'blocks.0.photos.0': 'a.png',
        'blocks.0.photos.1': 'b.png',
        'blocks.0.photos.2': 'c.png',
      });
    });

    it('should remove the only item', () => {
      mockEntryDraft.currentValues.en = { title: 'Hello', 'blocks.0.photos.0': 'a.png' };

      removeMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', index: 0 });

      expect(mockEntryDraft.currentValues.en).toEqual({ title: 'Hello' });
    });

    it('should support a custom value store key', () => {
      mockEntryDraft.extraValues = {
        en: { 'photos.0': 'a.png', 'photos.1': 'b.png' },
      };

      removeMultiValueItem({
        locale: 'en',
        valueStoreKey: 'extraValues',
        keyPath: 'photos',
        index: 0,
      });

      expect(mockEntryDraft.extraValues.en).toEqual({ 'photos.0': 'b.png' });
      // The other value store must be left alone
      expect(mockEntryDraft.currentValues.en['blocks.0.photos.0']).toBe('a.png');
    });

    it('should not return the updated list', () => {
      // The draft is the single source of truth for the field editor. Returning the list invites
      // the caller to assign it to the one-way `currentValue` prop, which would override the prop
      // locally and stop it from following the draft.
      expect(
        removeMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', index: 0 }),
      ).toBeUndefined();
    });

    it('should keep removing one item at a time on successive calls', () => {
      const remove = () =>
        removeMultiValueItem({ locale: 'en', keyPath: 'blocks.0.photos', index: 0 });

      /**
       * Get the remaining item values.
       * @returns {any[]} Values.
       */
      const items = () =>
        Object.entries(mockEntryDraft.currentValues.en)
          .filter(([key]) => key.startsWith('blocks.0.photos.'))
          .map(([, value]) => value);

      remove();
      expect(items()).toEqual(['b.png', 'c.png', 'd.png']);
      remove();
      expect(items()).toEqual(['c.png', 'd.png']);
      remove();
      expect(items()).toEqual(['d.png']);
      remove();
      expect(items()).toEqual([]);

      expect(mockEntryDraft.currentValues.en).toEqual({ title: 'Hello' });
    });
  });
});
