import { describe, expect, it } from 'vitest';

import { findFields, getCanonicalSlugKey, getRootFields, getSubFields, hasField } from './fields';

/**
 * @import { Field } from '$lib/types/public';
 */

/** @type {Field[]} */
const fields = [
  { name: 'title', label: 'Title', widget: 'string' },
  {
    name: 'author',
    label: 'Author',
    widget: 'object',
    fields: [{ name: 'name', label: 'Name', widget: 'string' }],
  },
  {
    name: 'images',
    label: 'Images',
    widget: 'list',
    fields: [
      { name: 'src', label: 'Source', widget: 'image' },
      { name: 'alt', label: 'Alt Text', widget: 'string' },
    ],
  },
  {
    name: 'thumbnail',
    label: 'Thumbnail',
    widget: 'list',
    field: { name: 'src', label: 'Source', widget: 'image' },
  },
  {
    name: 'blocks',
    label: 'Blocks',
    widget: 'list',
    types: [
      {
        name: 'heading',
        label: 'Heading',
        widget: 'object',
        fields: [{ name: 'text', label: 'Text', widget: 'string' }],
      },
      {
        name: 'image',
        label: 'Image',
        widget: 'object',
        fields: [{ name: 'src', label: 'Source', widget: 'image' }],
      },
    ],
  },
];

describe('Test findFields()', () => {
  it('should return the field a key path points to', () => {
    expect(findFields(fields, 'title')).toEqual([fields[0]]);
    expect(findFields(fields, 'author.name')).toEqual([/** @type {any} */ (fields[1]).fields[0]]);
    expect(findFields(fields, 'images.0.src')).toEqual([/** @type {any} */ (fields[2]).fields[0]]);
    expect(findFields(fields, 'thumbnail.src')).toEqual([/** @type {any} */ (fields[3]).field]);
    expect(findFields(fields, 'blocks.*<image>.src')).toEqual([
      /** @type {any} */ (fields[4]).types[1].fields[0],
    ]);
  });

  it('should return every subfield of the variable types sharing the name', () => {
    /** @type {Field[]} */
    const blocks = [
      {
        name: 'blocks',
        label: 'Blocks',
        widget: 'list',
        types: [
          {
            name: 'text',
            label: 'Text',
            widget: 'object',
            fields: [{ name: 'src', label: 'Source', widget: 'string' }],
          },
          {
            name: 'photo',
            label: 'Photo',
            widget: 'object',
            fields: [
              { name: 'src', label: 'Source', widget: 'image' },
              { name: 'meta', label: 'Meta', widget: 'object', fields: [{ name: 'alt' }] },
            ],
          },
          {
            name: 'video',
            label: 'Video',
            widget: 'object',
            fields: [
              { name: 'src', label: 'Source', widget: 'file' },
              { name: 'meta', label: 'Meta', widget: 'object', fields: [{ name: 'title' }] },
            ],
          },
        ],
      },
    ];

    expect(findFields(blocks, 'blocks.src').map(({ widget }) => widget)).toEqual([
      'string',
      'image',
      'file',
    ]);

    // Nested paths are followed through each match
    expect(findFields(blocks, 'blocks.meta.alt').map(({ name }) => name)).toEqual(['alt']);
    expect(findFields(blocks, 'blocks.meta.title').map(({ name }) => name)).toEqual(['title']);
    expect(findFields(blocks, 'blocks.meta.src')).toEqual([]);
  });

  it('should return an empty array for a key path that points to no field', () => {
    expect(findFields(fields, 'date')).toEqual([]);
    expect(findFields(fields, 'author.email')).toEqual([]);
    expect(findFields(fields, 'title.name')).toEqual([]);
    expect(findFields(fields, '')).toEqual([]);
  });
});

describe('Test hasField()', () => {
  it('should resolve a top-level field', () => {
    expect(hasField(fields, 'title')).toBe(true);
    expect(hasField(fields, 'date')).toBe(false);
  });

  it('should resolve a nested field', () => {
    expect(hasField(fields, 'author.name')).toBe(true);
    expect(hasField(fields, 'author.email')).toBe(false);
  });

  it('should resolve a list subfield with an index or wildcard', () => {
    expect(hasField(fields, 'images.0.src')).toBe(true);
    expect(hasField(fields, 'images.*.alt')).toBe(true);
    expect(hasField(fields, 'images.0.caption')).toBe(false);
    expect(hasField(fields, 'images.0')).toBe(true);
  });

  it('should resolve a single subfield of a list field', () => {
    expect(hasField(fields, 'thumbnail.src')).toBe(true);
    expect(hasField(fields, 'thumbnail.0.src')).toBe(true);
    expect(hasField(fields, 'thumbnail.0.alt')).toBe(false);
  });

  it('should resolve a subfield of any variable type', () => {
    expect(hasField(fields, 'blocks.0.text')).toBe(true);
    expect(hasField(fields, 'blocks.0.src')).toBe(true);
    expect(hasField(fields, 'blocks.0.caption')).toBe(false);
  });

  it('should resolve the type key of a variable type field', () => {
    expect(hasField(fields, 'blocks.0.type')).toBe(true);
    expect(hasField(fields, 'blocks.0.type.foo')).toBe(false);

    const customTypeKey = /** @type {Field[]} */ ([
      { .../** @type {any} */ (fields[4]), typeKey: 'kind' },
    ]);

    expect(hasField(customTypeKey, 'blocks.0.kind')).toBe(true);
    expect(hasField(customTypeKey, 'blocks.0.type')).toBe(false);
  });

  it('should ignore the explicit variable type syntax', () => {
    expect(hasField(fields, 'blocks.*<heading>.text')).toBe(true);
    expect(hasField(fields, 'blocks.*<heading>.caption')).toBe(false);
  });

  it('should not resolve a subfield of a field without subfields', () => {
    expect(hasField(fields, 'title.text')).toBe(false);
  });

  it('should not resolve an empty or index-only key path', () => {
    expect(hasField(fields, '')).toBe(false);
    expect(hasField(fields, '0')).toBe(false);
    expect(hasField([], 'title')).toBe(false);
  });
});

describe('Test getSubFields()', () => {
  it('should return the single subfield of a List field', () => {
    const subfield = { name: 'item', widget: 'string' };

    expect(getSubFields(/** @type {any} */ ({ name: 'items', field: subfield }))).toEqual([
      subfield,
    ]);
  });

  it('should return the subfields of a List or Object field', () => {
    const subfields = [{ name: 'a' }, { name: 'b' }];

    expect(getSubFields(/** @type {any} */ ({ name: 'meta', fields: subfields }))).toBe(subfields);
  });

  it('should return the subfields of every variable type along with the type key', () => {
    const field = /** @type {any} */ ({
      name: 'blocks',
      types: [{ name: 'text', fields: [{ name: 'body' }] }, { name: 'divider' }],
    });

    expect(getSubFields(field)).toEqual([{ name: 'body' }, { name: 'type' }]);
    expect(getSubFields({ ...field, typeKey: 'kind' })).toEqual([
      { name: 'body' },
      { name: 'kind' },
    ]);
  });

  it('should return nothing for a field without subfields', () => {
    expect(getSubFields(/** @type {any} */ ({ name: 'title', widget: 'string' }))).toEqual([]);
  });
});

describe('Test getRootFields()', () => {
  const rootFields = [{ name: 'title' }];
  const indexFields = [{ name: 'heading' }];
  const fileFields = [{ name: 'siteName' }];
  /** @type {any} */
  const collection = { name: 'posts', folder: 'content/posts', fields: rootFields };
  /** @type {any} */
  const collectionFile = { name: 'general', file: 'general.yaml', fields: fileFields };

  it('should return the fields of a collection file over anything else', () => {
    expect(getRootFields({ collection, collectionFile, isIndexFile: true })).toBe(fileFields);
  });

  it('should return the fields of an entry collection', () => {
    expect(getRootFields({ collection })).toBe(rootFields);
    expect(getRootFields({ collection, isIndexFile: true })).toBe(rootFields);
    expect(
      getRootFields({ collection: { ...collection, index_file: true }, isIndexFile: true }),
    ).toBe(rootFields);
  });

  it('should return the fields of an index file when it has its own', () => {
    const withIndexFile = { ...collection, index_file: { fields: indexFields } };

    expect(getRootFields({ collection: withIndexFile, isIndexFile: true })).toBe(indexFields);
    expect(getRootFields({ collection: withIndexFile })).toBe(rootFields);
    expect(
      getRootFields({ collection: { ...collection, index_file: {} }, isIndexFile: true }),
    ).toBe(rootFields);
  });

  it('should return nothing outside an entry collection', () => {
    expect(getRootFields({})).toBeUndefined();
    expect(getRootFields({ componentName: 'my-component' })).toBeUndefined();
    expect(getRootFields({ collection: { name: 'settings', files: [] } })).toBeUndefined();
  });
});

describe('Test getCanonicalSlugKey()', () => {
  /** @type {any} */
  const cmsConfig = { i18n: { locales: ['en', 'fr'] } };
  /** @type {any} */
  const collection = { name: 'posts', i18n: true };

  /**
   * Call the function with loosely typed arguments.
   * @param {object} args Arguments.
   * @param {any} args.cmsConfig Site configuration.
   * @param {any} [args.collection] Collection configuration.
   * @param {any} [args.file] Collection file configuration.
   * @returns {string | undefined} The key.
   */
  const getKey = ({ cmsConfig: config, collection: col = collection, file }) =>
    getCanonicalSlugKey({ cmsConfig: config, collection: col, file });

  it('should return the default key when i18n is enabled', () => {
    expect(getKey({ cmsConfig })).toBe('translationKey');
  });

  it('should return a custom key defined at the site, collection or file level', () => {
    expect(
      getKey({ cmsConfig: { i18n: { ...cmsConfig.i18n, canonical_slug: { key: 'site_key' } } } }),
    ).toBe('site_key');

    expect(
      getKey({
        cmsConfig,
        collection: { ...collection, i18n: { canonical_slug: { key: 'collection_key' } } },
      }),
    ).toBe('collection_key');

    expect(getKey({ cmsConfig, file: { i18n: { canonical_slug: { key: 'file_key' } } } })).toBe(
      'file_key',
    );
  });

  it('should return `undefined` when i18n is not enabled', () => {
    expect(getKey({ cmsConfig: undefined })).toBeUndefined();
    expect(getKey({ cmsConfig: {} })).toBeUndefined();
    expect(getKey({ cmsConfig: { i18n: { locales: [] } } })).toBeUndefined();
    expect(getKey({ cmsConfig, collection: { name: 'posts' } })).toBeUndefined();
    expect(getKey({ cmsConfig, file: { i18n: false } })).toBeUndefined();
  });
});
