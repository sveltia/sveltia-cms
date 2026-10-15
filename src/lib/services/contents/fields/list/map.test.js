import { describe, expect, test, vi } from 'vitest';

import {
  convertMapLists,
  getMapKeyField,
  getMapKeyInfo,
  getMapKeyPaths,
  isArrayIndexKey,
  isMapKeyTaken,
  itemsToMap,
  mapToItems,
} from './map';

/**
 * @import { Field } from '$lib/types/public';
 */

/** @type {Field[]} */
const fields = [
  { name: 'title', widget: 'string' },
  {
    name: 'references',
    widget: 'list',
    map_key_field: 'key',
    fields: [
      { name: 'key', widget: 'string' },
      { name: 'title', widget: 'string' },
    ],
  },
  {
    name: 'tags',
    widget: 'list',
    fields: [{ name: 'key', widget: 'string' }],
  },
];

vi.mock('$lib/services/contents/collection', () => ({
  getCollection: vi.fn(() => ({ name: 'posts', _type: 'entry', fields })),
}));

describe('Test getMapKeyField()', () => {
  test('should return the subfield name of a List field with subfields', () => {
    expect(getMapKeyField(fields[1])).toBe('key');
  });

  test('should return the subfield name of a List field with variable types', () => {
    expect(getMapKeyField({ name: 'blocks', widget: 'list', map_key_field: 'id', types: [] })).toBe(
      'id',
    );
  });

  test('should ignore a List field without subfields or variable types', () => {
    expect(
      getMapKeyField(/** @type {Field} */ ({ name: 'tags', widget: 'list', map_key_field: 'key' })),
    ).toBeUndefined();
    expect(
      getMapKeyField(
        /** @type {Field} */ ({
          name: 'tags',
          widget: 'list',
          map_key_field: 'key',
          field: { name: 'key', widget: 'string' },
        }),
      ),
    ).toBeUndefined();
  });

  test('should ignore another field type, an empty name and a value of another type', () => {
    expect(
      getMapKeyField(
        /** @type {Field} */ ({ name: 'meta', widget: 'object', map_key_field: 'key', fields: [] }),
      ),
    ).toBeUndefined();
    expect(
      getMapKeyField({ name: 'references', widget: 'list', map_key_field: '', fields: [] }),
    ).toBeUndefined();
    expect(
      getMapKeyField(
        /** @type {Field} */ ({ name: 'references', widget: 'list', map_key_field: 1, fields: [] }),
      ),
    ).toBeUndefined();
    expect(getMapKeyField(fields[2])).toBeUndefined();
  });
});

describe('Test isArrayIndexKey()', () => {
  test('should match a canonical array index', () => {
    expect(isArrayIndexKey('0')).toBe(true);
    expect(isArrayIndexKey('1')).toBe(true);
    expect(isArrayIndexKey('2024')).toBe(true);
    expect(isArrayIndexKey(String(2 ** 32 - 2))).toBe(true);
  });

  test('should not match a key that a JavaScript object keeps in order', () => {
    expect(isArrayIndexKey('01')).toBe(false);
    expect(isArrayIndexKey('-1')).toBe(false);
    expect(isArrayIndexKey('1.5')).toBe(false);
    expect(isArrayIndexKey(' 1')).toBe(false);
    expect(isArrayIndexKey('2024a')).toBe(false);
    expect(isArrayIndexKey('')).toBe(false);
    expect(isArrayIndexKey(String(2 ** 32 - 1))).toBe(false);
  });
});

describe('Test mapToItems()', () => {
  test('should convert a map to list items in the same order, adding each key', () => {
    expect(
      mapToItems({ harry: { title: 'Harry' }, ron: { title: 'Ron' }, empty: null }, 'key'),
    ).toEqual([{ title: 'Harry', key: 'harry' }, { title: 'Ron', key: 'ron' }, { key: 'empty' }]);
  });

  test('should let the map key win over a property of the same name', () => {
    expect(mapToItems({ harry: { key: 'other', title: 'Harry' } }, 'key')).toEqual([
      { key: 'harry', title: 'Harry' },
    ]);
  });

  test('should return an empty map as an empty list', () => {
    expect(mapToItems({}, 'key')).toEqual([]);
  });

  test('should return anything other than a map of objects as is', () => {
    const list = [{ key: 'harry' }];

    expect(mapToItems(list, 'key')).toBe(list);
    expect(mapToItems('harry', 'key')).toBe('harry');
    expect(mapToItems(undefined, 'key')).toBeUndefined();

    const map = { harry: 'Harry' };

    expect(mapToItems(map, 'key')).toBe(map);
  });
});

describe('Test itemsToMap()', () => {
  test('should convert list items to a map in the same order, removing each key', () => {
    const result = itemsToMap(
      [
        { key: 'harry', title: 'Harry' },
        { title: 'Ron', key: 'ron' },
      ],
      'key',
    );

    expect(result).toEqual({ harry: { title: 'Harry' }, ron: { title: 'Ron' } });
    expect(Object.keys(result)).toEqual(['harry', 'ron']);
  });

  test('should use an empty key for an item without a key or an item that is not an object', () => {
    expect(itemsToMap([{ title: 'Harry' }], 'key')).toEqual({ '': { title: 'Harry' } });
    expect(itemsToMap(['harry'], 'key')).toEqual({ '': {} });
  });

  test('should stringify a key that is not a string', () => {
    expect(itemsToMap([{ key: 12.5 }], 'key')).toEqual({ 12.5: {} });
  });

  test('should return anything other than an array as is', () => {
    const map = { harry: {} };

    expect(itemsToMap(map, 'key')).toBe(map);
    expect(itemsToMap(undefined, 'key')).toBeUndefined();
  });
});

describe('Test convertMapLists()', () => {
  /** @type {Field[]} */
  const nestedFields = [
    { name: 'title', widget: 'string' },
    {
      name: 'meta',
      widget: 'object',
      fields: [
        {
          name: 'people',
          widget: 'list',
          map_key_field: 'id',
          fields: [
            { name: 'id', widget: 'string' },
            {
              name: 'roles',
              widget: 'list',
              map_key_field: 'name',
              fields: [{ name: 'name', widget: 'string' }],
            },
          ],
        },
      ],
    },
    {
      name: 'blocks',
      widget: 'list',
      map_key_field: 'id',
      typeKey: 'kind',
      types: [
        {
          name: 'quote',
          widget: 'object',
          fields: [
            { name: 'id', widget: 'string' },
            {
              name: 'sources',
              widget: 'list',
              map_key_field: 'url',
              fields: [{ name: 'url', widget: 'string' }],
            },
          ],
        },
      ],
    },
    {
      name: 'groups',
      widget: 'list',
      field: {
        name: 'group',
        widget: 'object',
        fields: [
          {
            name: 'members',
            widget: 'list',
            map_key_field: 'id',
            fields: [{ name: 'id', widget: 'string' }],
          },
        ],
      },
    },
    {
      name: 'sections',
      widget: 'object',
      types: [
        { name: 'divider', widget: 'object' },
        {
          name: 'faq',
          widget: 'object',
          fields: [
            {
              name: 'questions',
              widget: 'list',
              map_key_field: 'id',
              fields: [{ name: 'id', widget: 'string' }],
            },
          ],
        },
      ],
    },
  ];

  const stored = {
    title: 'Hello',
    meta: {
      people: {
        jane: { roles: { editor: {}, author: {} } },
        alex: {},
      },
    },
    blocks: {
      intro: { kind: 'quote', sources: { 'https://a.example': {} } },
      other: { kind: 'unknown', sources: { 'https://b.example': {} } },
    },
    groups: [{ members: { x: {} } }, null],
    sections: { type: 'faq', questions: { q1: {} } },
    extra: { anything: true },
  };

  const items = {
    title: 'Hello',
    meta: {
      people: [{ id: 'jane', roles: [{ name: 'editor' }, { name: 'author' }] }, { id: 'alex' }],
    },
    blocks: [
      { kind: 'quote', id: 'intro', sources: [{ url: 'https://a.example' }] },
      // An item of an unknown type has no subfields to convert
      { kind: 'unknown', id: 'other', sources: { 'https://b.example': {} } },
    ],
    groups: [{ members: [{ id: 'x' }] }, null],
    sections: { type: 'faq', questions: [{ id: 'q1' }] },
    extra: { anything: true },
  };

  test('should convert maps to list items at any depth', () => {
    expect(convertMapLists(stored, nestedFields, true)).toEqual(items);
  });

  test('should convert list items back to maps at any depth', () => {
    expect(convertMapLists(items, nestedFields, false)).toEqual(stored);
  });

  test('should not modify the given content', () => {
    const copy = structuredClone(stored);

    convertMapLists(stored, nestedFields, true);
    expect(stored).toEqual(copy);
  });

  test('should return the same objects if nothing has changed', () => {
    const content = { title: 'Hello', groups: [{ members: undefined }], tags: ['a'] };

    expect(convertMapLists(content, nestedFields, true)).toBe(content);
    expect(convertMapLists(content, fields, false)).toBe(content);
  });

  test('should return anything other than an object as is', () => {
    expect(convertMapLists(/** @type {any} */ (undefined), nestedFields, true)).toBeUndefined();
  });

  test('should leave a value of another field type with subfields alone', () => {
    const content = { custom: { people: { jane: {} } } };

    /** @type {Field[]} */
    const customFields = [
      /** @type {any} */ ({
        name: 'custom',
        widget: 'custom-type',
        fields: [
          {
            name: 'people',
            widget: 'list',
            map_key_field: 'id',
            fields: [{ name: 'id', widget: 'string' }],
          },
        ],
      }),
    ];

    expect(convertMapLists(content, customFields, true)).toBe(content);
  });
});

describe('Test getMapKeyInfo()', () => {
  test('should return the list key path and key subfield name', () => {
    expect(getMapKeyInfo({ collectionName: 'posts', keyPath: 'references.3.key' })).toEqual({
      listKeyPath: 'references',
      keyField: 'key',
    });
  });

  test('should return undefined for another subfield or a list without the option', () => {
    expect(getMapKeyInfo({ collectionName: 'posts', keyPath: 'references.0.title' })).toBe(
      undefined,
    );
    expect(getMapKeyInfo({ collectionName: 'posts', keyPath: 'tags.0.key' })).toBeUndefined();
    expect(getMapKeyInfo({ collectionName: 'posts', keyPath: 'unknown.0.key' })).toBeUndefined();
  });

  test('should return undefined for a key path that is not a list item subfield', () => {
    expect(getMapKeyInfo({ collectionName: 'posts', keyPath: 'title' })).toBeUndefined();
    expect(getMapKeyInfo({ collectionName: 'posts', keyPath: 'references.0' })).toBeUndefined();
  });

  test('should return undefined in a rich text editor component', () => {
    expect(
      getMapKeyInfo({
        collectionName: 'posts',
        componentName: 'image',
        keyPath: 'references.0.key',
      }),
    ).toBeUndefined();
  });
});

describe('Test getMapKeyPaths()', () => {
  test('should return the key paths of the key subfield of every item', () => {
    expect(
      getMapKeyPaths({
        valueMap: {
          title: 'Hello',
          'references.0.key': 'a',
          'references.0.title': 'A',
          'references.1.key': 'b',
          'references.x.key': 'c',
          'other.references.2.key': 'd',
          'references.2.key.nested': 'e',
        },
        listKeyPath: 'references',
        keyField: 'key',
      }),
    ).toEqual(['references.0.key', 'references.1.key']);
  });
});

describe('Test isMapKeyTaken()', () => {
  const valueMap = {
    'references.0.key': 'harry',
    'references.1.key': 'ron',
    'references.2.key': 'harry',
    'references.3.key': 2024,
  };

  const args = { valueMap, listKeyPath: 'references', keyField: 'key' };

  test('should return true if another item has the same key', () => {
    expect(isMapKeyTaken({ ...args, keyPath: 'references.0.key', value: 'harry' })).toBe(true);
    expect(isMapKeyTaken({ ...args, keyPath: 'references.1.key', value: '2024' })).toBe(true);
  });

  test('should not compare with an item without a key', () => {
    const map = { 'references.0.key': 'undefined', 'references.1.key': undefined };
    const nullMap = { 'references.0.key': 'null', 'references.1.key': null };

    expect(
      isMapKeyTaken({ ...args, valueMap: map, keyPath: 'references.0.key', value: 'undefined' }),
    ).toBe(false);
    expect(
      isMapKeyTaken({ ...args, valueMap: nullMap, keyPath: 'references.0.key', value: 'null' }),
    ).toBe(false);
  });

  test('should return false if no other item has the same key', () => {
    expect(isMapKeyTaken({ ...args, keyPath: 'references.1.key', value: 'ron' })).toBe(false);
    expect(isMapKeyTaken({ ...args, keyPath: 'references.1.key', value: 'Harry' })).toBe(false);
  });
});
