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

  test('creates a new item if there is no item to duplicate', () => {
    // e.g. another locale of a list with paired items, which lacks the item being duplicated
    expect(createListItem({ ...args, valueList: [{ name: 'Alice' }], dupIndex: 1 })).toEqual(
      expect.objectContaining({ name: 'Anonymous', __sc_item_id: expect.any(String) }),
    );
  });

  describe('renews the unique values of a duplicated item', () => {
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const OLD_ID = 'de305d54-75b4-431b-adb2-eb6b9e546014';
    const OTHER_ID = '6f1c2d3e-4b5a-4c6d-8e7f-901a2b3c4d5e';

    /** @type {import('$lib/types/public').Field[]} */
    const uniqueSubFields = [
      { name: 'id', widget: 'uuid' },
      { name: 'ref', widget: 'uuid', prefix: 'ref-' },
      { name: 'slug', widget: 'compute', value: 'item-{{uuid_short}}' },
      { name: 'position', widget: 'compute', value: '{{index}}' },
      { name: 'title', widget: 'string' },
      {
        name: 'meta',
        widget: 'object',
        fields: [{ name: 'id', widget: 'uuid' }],
      },
      {
        name: 'tags',
        widget: 'list',
        field: { name: 'tag', widget: 'uuid' },
      },
      {
        name: 'blocks',
        widget: 'list',
        typeKey: 'kind',
        types: [
          { name: 'text', fields: [{ name: 'id', widget: 'uuid' }] },
          { name: 'image', fields: [{ name: 'src', widget: 'string' }] },
        ],
      },
      { name: 'empty', widget: 'list', fields: [{ name: 'id', widget: 'uuid' }] },
    ];

    test('regenerates UUIDs and clears Compute fields with a UUID tag', () => {
      const source = {
        id: OLD_ID,
        ref: `ref-${OLD_ID}`,
        slug: 'item-eb6b9e546014',
        position: 0,
        title: OLD_ID,
        meta: { id: OLD_ID },
        tags: [OLD_ID, ''],
        blocks: [
          { kind: 'text', id: OLD_ID },
          { kind: 'image', src: 'a.png' },
          { kind: 'unknown', id: OLD_ID },
          'not an object',
        ],
        empty: null,
      };

      const valueList = [source];

      const item = createListItem({
        ...args,
        subFields: uniqueSubFields,
        valueList,
        dupIndex: 0,
      });

      expect(item.id).toMatch(UUID_REGEX);
      expect(item.id).not.toBe(OLD_ID);
      expect(item.ref).toMatch(/^ref-[0-9a-f-]{36}$/);
      expect(item.ref).not.toBe(source.ref);
      // Resolved with new UUIDs once the item is in place
      expect(item.slug).toBe('');
      expect(item.position).toBe(0);
      // Not a UUID field
      expect(item.title).toBe(OLD_ID);
      expect(item.meta.id).toMatch(UUID_REGEX);
      expect(item.meta.id).not.toBe(OLD_ID);
      expect(item.tags[0]).toMatch(UUID_REGEX);
      expect(item.tags[0]).not.toBe(OLD_ID);
      // An empty value is filled in by the field editor
      expect(item.tags[1]).toBe('');
      expect(item.blocks[0].id).toMatch(UUID_REGEX);
      expect(item.blocks[0].id).not.toBe(OLD_ID);
      expect(item.blocks[1]).toEqual({ kind: 'image', src: 'a.png' });
      expect(item.blocks[2]).toEqual({ kind: 'unknown', id: OLD_ID });
      expect(item.blocks[3]).toBe('not an object');
      expect(item.empty).toBeNull();
      // The source is left alone
      expect(source.id).toBe(OLD_ID);
      expect(source.meta.id).toBe(OLD_ID);
      expect(source.slug).toBe('item-eb6b9e546014');
    });

    test('gives a UUID the same new value in every locale sharing the map', () => {
      /** @type {import('$lib/types/public').Field[]} */
      const fields = [{ name: 'id', widget: 'uuid' }];
      const renewedUuids = new Map();

      // A duplicated UUID holds the same value in every locale, while a translatable one doesn’t
      const [en, fr, de] = [OLD_ID, OLD_ID, OTHER_ID].map((id) =>
        createListItem({
          ...args,
          subFields: fields,
          valueList: [{ id }],
          dupIndex: 0,
          renewedUuids,
        }),
      );

      expect(en.id).not.toBe(OLD_ID);
      expect(fr.id).toBe(en.id);
      expect(de.id).not.toBe(OTHER_ID);
      expect(de.id).not.toBe(en.id);

      // Another duplicate, without the map, gets UUIDs of its own
      const next = createListItem({
        ...args,
        subFields: fields,
        valueList: [{ id: OLD_ID }],
        dupIndex: 0,
      });

      expect(next.id).toMatch(UUID_REGEX);
      expect(next.id).not.toBe(en.id);
    });

    test('resolves the type of a duplicated item of a list with variable types', () => {
      /** @type {any[]} */
      const types = [{ name: 'author', fields: [{ name: 'id', widget: 'uuid' }] }];

      const item = createListItem({
        ...args,
        subFields: [],
        types,
        valueList: [{ type: 'author', id: OLD_ID }],
        dupIndex: 0,
      });

      expect(item.type).toBe('author');
      expect(item.id).toMatch(UUID_REGEX);
      expect(item.id).not.toBe(OLD_ID);
    });

    test('regenerates the UUID of a list with a single UUID subfield', () => {
      const field = { name: 'id', widget: 'uuid' };

      const item = createListItem({
        ...args,
        subFields: [field],
        field,
        hasSingleSubField: true,
        valueList: [OLD_ID],
        dupIndex: 0,
      });

      expect(item).toMatch(UUID_REGEX);
      expect(item).not.toBe(OLD_ID);
    });

    test('leaves a non-object item of a list without a single subfield definition', () => {
      expect(
        createListItem({
          ...args,
          subFields: [{ name: 'id', widget: 'uuid' }],
          hasSingleSubField: true,
          valueList: [OLD_ID],
          dupIndex: 0,
        }),
      ).toBe(OLD_ID);
    });
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
