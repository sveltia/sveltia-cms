import { describe, expect, test, vi } from 'vitest';

import {
  createListItem,
  getInitialListExpanderStates,
} from '$lib/services/contents/fields/list/items';

vi.mock('$lib/services/config');

describe('getInitialListExpanderStates()', () => {
  /** @type {any} */
  const draft = { expanderStates: { _: { 'authors.1': false } }, currentValues: { en: {} } };

  test('expands the list and its items by default, keeping a stored state', () => {
    expect(
      getInitialListExpanderStates({ draft, keyPath: 'authors', itemCount: 2, locale: 'en' }),
    ).toEqual({ 'authors#': true, 'authors.0': true, 'authors.1': false });
  });

  test('collapses the items with the `collapsed` option', () => {
    expect(
      getInitialListExpanderStates({
        draft,
        keyPath: 'tags',
        itemCount: 1,
        locale: 'en',
        collapsed: true,
      }),
    ).toEqual({ 'tags#': true, 'tags.0': false });
  });

  test('minimizes the list with the `minimize_collapsed` option', () => {
    expect(
      getInitialListExpanderStates({
        draft,
        keyPath: 'tags',
        itemCount: 0,
        locale: 'en',
        minimizeCollapsed: true,
      }),
    ).toEqual({ 'tags#': false });
  });

  test('only minimizes a list with items with `minimize_collapsed: auto`', () => {
    const args = {
      draft,
      keyPath: 'tags',
      locale: 'en',
      minimizeCollapsed: /** @type {const} */ ('auto'),
    };

    expect(getInitialListExpanderStates({ ...args, itemCount: 0 })).toEqual({ 'tags#': true });
    expect(getInitialListExpanderStates({ ...args, itemCount: 1 })).toEqual({
      'tags#': false,
      'tags.0': true,
    });
  });
});

describe('createListItem()', () => {
  /** @type {import('$lib/types/public').Field[]} */
  const subFields = [
    { name: 'name', widget: 'string', default: 'Anonymous' },
    { name: 'links', widget: 'object', fields: [{ name: 'url', widget: 'string' }] },
  ];

  const args = {
    keyPath: 'authors',
    subFields,
    hasSingleSubField: false,
    typeKey: 'type',
    locale: 'en',
    defaultLocale: 'en',
  };

  test('creates an item with the default values, tagging the existing items', () => {
    const valueList = [{ name: 'Alice' }];
    const item = createListItem({ ...args, valueList });

    expect(item).toEqual({
      name: 'Anonymous',
      links: { url: '' },
      __sc_item_id: expect.any(String),
    });
    expect(valueList).toEqual([{ name: 'Alice', __sc_item_original_key_path: 'authors.0' }]);
  });

  test('creates an item of the given type', () => {
    expect(createListItem({ ...args, valueList: [], type: 'author' })).toEqual(
      expect.objectContaining({ name: 'Anonymous', type: 'author' }),
    );
  });

  test('duplicates an item as a new one', () => {
    const valueList = [
      { name: 'Alice', links: { url: 'https://example.com' }, __sc_item_id: 'a' },
      { name: 'Bob', __sc_item_original_key_path: 'authors.0' },
    ];

    const item = createListItem({ ...args, valueList, dupIndex: 0 });

    expect(item).toEqual({
      name: 'Alice',
      links: { url: 'https://example.com' },
      __sc_item_id: expect.any(String),
    });
    expect(item.__sc_item_id).not.toBe('a');
    expect(item.links).not.toBe(valueList[0].links);

    const duplicate = createListItem({ ...args, valueList, dupIndex: 1 });

    // The source position isn’t carried over
    expect(duplicate).toEqual({ name: 'Bob', __sc_item_id: expect.any(String) });
  });

  test('creates a value for a list with a single subfield', () => {
    const valueList = ['a'];
    const field = { name: 'tag', widget: 'string', default: 'new' };
    const singleArgs = { ...args, subFields: [field], field, hasSingleSubField: true };

    expect(createListItem({ ...singleArgs, valueList })).toBe('new');
    expect(createListItem({ ...singleArgs, valueList, dupIndex: 0 })).toBe('a');
    // The items are left alone
    expect(valueList).toEqual(['a']);
  });

  test('creates an object for a list without a single subfield definition', () => {
    expect(
      createListItem({
        ...args,
        subFields: [{ name: 'tag', widget: 'string' }],
        hasSingleSubField: true,
        valueList: [],
      }),
    ).toEqual({ tag: '' });
  });
});
