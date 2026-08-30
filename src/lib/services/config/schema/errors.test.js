import { describe, expect, test, vi } from 'vitest';

/**
 * @import { SchemaValidationError } from '$lib/types/private';
 */

vi.mock('@sveltia/i18n', () => ({
  /**
   * Mock translation function that spells out the message key and the values it was given.
   * @param {string} key Message key.
   * @param {any} [options] Options.
   * @returns {string} Message.
   */
  _: (key, options) =>
    [key, ...Object.entries(options?.values ?? {}).map(([k, v]) => `${k}=${v}`)].join(' '),
  locale: { current: 'en-US' },
}));

const { locateError, reportSchemaErrors } = await import('./errors');

const config = /** @type {any} */ ({
  backend: { name: 'github', repo: 'o/r' },
  collections: [
    {
      name: 'blog',
      label: 'Blog',
      folder: 'content',
      view_filters: [{ label: 'Drafts', field: 'draft', pattern: true }],
      fields: [
        { name: 'title', widget: 'string' },
        { name: 'meta', widget: 'object', fields: [{ name: 'desc', widget: 'text' }] },
        { name: 'tags', widget: 'list', field: { name: 'tag', widget: 'string' } },
        {
          name: 'blocks',
          widget: 'list',
          types: [{ name: 'quote', widget: 'object', fields: [{ name: 'text', widget: 'text' }] }],
        },
        {
          name: 'box',
          widget: 'object',
          types: [{ name: 'wide', fields: [{ name: 'span', widget: 'number' }] }],
        },
      ],
    },
    { name: 'pages', label: 'Pages', files: [{ name: 'about', label: 'About', file: 'a.md' }] },
  ],
  singletons: [{ name: 'home', label: 'Home', file: 'h.md' }],
});

/**
 * Collect the messages the given errors produce.
 * @param {Partial<SchemaValidationError>[]} errors Validation errors.
 * @returns {string[]} Messages.
 */
const report = (errors) => {
  /** @type {any} */
  const collectors = { errors: new Set(), warnings: new Set() };

  reportSchemaErrors({ config, errors: /** @type {any} */ (errors), collectors });

  return [...collectors.errors];
};

describe('config/schema/errors', () => {
  describe('locateError', () => {
    test('locates a top-level option', () => {
      expect(locateError(config, '/backend/name')).toEqual({
        context: {},
        option: ['backend', 'name'],
      });
    });

    test('locates a collection option', () => {
      const { context, option } = locateError(config, '/collections/0/create');

      expect(context.collection).toBe(config.collections[0]);
      expect(option).toEqual(['create']);
    });

    test('locates an option inside a collection’s array of objects', () => {
      const { context, option } = locateError(config, '/collections/0/view_filters/0/pattern');

      expect(context.collection).toBe(config.collections[0]);
      expect(option).toEqual(['view_filters', '0', 'pattern']);
    });

    test('locates a collection file', () => {
      const { context, option } = locateError(config, '/collections/1/files/0/file');

      expect(context.collection).toBe(config.collections[1]);
      expect(context.collectionFile).toBe(config.collections[1].files[0]);
      expect(option).toEqual(['file']);
    });

    test('locates a singleton', () => {
      const { context, option } = locateError(config, '/singletons/0/fields');

      expect(context.collection).toBeUndefined();
      expect(context.collectionFile).toBe(config.singletons[0]);
      expect(option).toEqual(['fields']);
    });

    test('locates a field', () => {
      const { context, option } = locateError(config, '/collections/0/fields/0/widget');

      expect(context.typedKeyPath).toBe('title');
      expect(option).toEqual(['widget']);
    });

    test('locates a sub-field of an Object field', () => {
      expect(locateError(config, '/collections/0/fields/1/fields/0/widget').context.typedKeyPath) //
        .toBe('meta.desc');
    });

    test('locates the single sub-field of a List field', () => {
      expect(locateError(config, '/collections/0/fields/2/field/widget').context.typedKeyPath) //
        .toBe('tags.*.tag');
    });

    test('locates a variable type of a List field', () => {
      expect(
        locateError(config, '/collections/0/fields/3/types/0/fields/0/label').context.typedKeyPath,
      ).toBe('blocks.*<quote>.text');
    });

    test('locates a variable type of an Object field', () => {
      expect(
        locateError(config, '/collections/0/fields/4/types/0/fields/0/label').context.typedKeyPath,
      ).toBe('box<wide>.span');
    });

    test('treats an index that isn’t an object as part of the option path', () => {
      expect(locateError(config, '/collections/0/sortable_fields/0').option) //
        .toEqual(['sortable_fields', '0']);
    });

    test('treats files outside a collection as part of the option path', () => {
      expect(locateError(config, '/files/0/name').option).toEqual(['files', '0', 'name']);
    });

    test('decodes escaped pointer segments', () => {
      expect(locateError(config, '/output/a~1b/c~0d').option).toEqual(['output', 'a/b', 'c~d']);
    });

    test('locates the root', () => {
      expect(locateError(config, '')).toEqual({ context: {}, option: [] });
    });
  });

  describe('reportSchemaErrors', () => {
    test('describes a wrong value type', () => {
      expect(
        report([
          { instancePath: '/collections/0/create', keyword: 'type', params: { type: 'boolean' } },
        ]),
      ).toEqual([
        'config.error_locator.collection collection=Blog: ' +
          'config.error.schema_invalid_type option=create ' +
          'type=config.error.schema_value_type.boolean',
      ]);
    });

    test('describes the types of a value that may take several', () => {
      expect(
        report([
          { instancePath: '/x', keyword: 'type', params: { type: 'boolean' } },
          { instancePath: '/x', keyword: 'type', params: { type: 'array' } },
        ]),
      ).toEqual([
        'config.error.schema_invalid_type option=x ' +
          'type=config.error.schema_value_type.boolean or config.error.schema_value_type.array',
      ]);
    });

    test('describes a type the schema names in an unexpected way', () => {
      expect(report([{ instancePath: '/x', keyword: 'type', params: { type: ['string'] } }])) //
        .toEqual(['config.error.schema_invalid_value option=x']);
    });

    test('describes an unaccepted value', () => {
      expect(
        report([
          {
            instancePath: '/publish_mode',
            keyword: 'enum',
            params: { allowedValues: ['', 'simple'] },
          },
        ]),
      ).toEqual(['config.error.schema_invalid_enum option=publish_mode values=`""` or `simple`']);
    });

    test('describes a value pinned to a constant', () => {
      expect(report([{ instancePath: '/x', keyword: 'const', params: { allowedValue: 'github' } }])) //
        .toEqual(['config.error.schema_invalid_const option=x value=github']);
    });

    test('describes a value pinned to an empty string', () => {
      expect(report([{ instancePath: '/x', keyword: 'const', params: { allowedValue: '' } }])) //
        .toEqual(['config.error.schema_invalid_empty_value option=x']);
    });

    test('describes an array of the wrong length', () => {
      expect(report([{ instancePath: '/x', keyword: 'minItems', params: { limit: 2 } }])) //
        .toEqual(['config.error.schema_invalid_item_count option=x count=2']);
      expect(report([{ instancePath: '/x', keyword: 'maxItems', params: { limit: 2 } }])) //
        .toEqual(['config.error.schema_invalid_item_count option=x count=2']);
    });

    test('describes a constraint it has no wording for', () => {
      expect(report([{ instancePath: '/x', keyword: 'minLength', params: { limit: 1 } }])) //
        .toEqual(['config.error.schema_invalid_value option=x']);
    });

    test('describes a missing option', () => {
      expect(
        report([
          {
            instancePath: '/collections/1/files/0',
            keyword: 'required',
            params: { missingProperty: 'fields' },
          },
        ]),
      ).toEqual([
        'config.error_locator.collection collection=Pages, config.error_locator.file file=About: ' +
          'config.error.schema_missing_option option=fields',
      ]);
    });

    test('merges the options a union offers into a single message', () => {
      expect(
        report([
          { instancePath: '', keyword: 'required', params: { missingProperty: 'collections' } },
          { instancePath: '', keyword: 'required', params: { missingProperty: 'singletons' } },
          { instancePath: '', keyword: 'anyOf', params: {} },
        ]),
      ).toEqual(['config.error.schema_missing_one_of options=`collections` or `singletons`']);
    });

    test('keeps unrelated missing options apart', () => {
      expect(
        report([
          { instancePath: '/x', keyword: 'required', params: { missingProperty: 'a' } },
          { instancePath: '/x', keyword: 'required', params: { missingProperty: 'b' } },
        ]),
      ).toEqual([
        'config.error.schema_missing_option option=x.a',
        'config.error.schema_missing_option option=x.b',
      ]);
    });

    test('reports a union that failed without any usable detail', () => {
      expect(report([{ instancePath: '/x', keyword: 'anyOf', params: {} }])) //
        .toEqual(['config.error.schema_invalid_value option=x']);
    });

    test('ignores the branch selections of a union', () => {
      expect(
        report([{ instancePath: '/x', keyword: 'if', params: { failingKeyword: 'then' } }]),
      ).toEqual([]);
    });

    test('keeps only the innermost location', () => {
      expect(
        report([
          {
            instancePath: '/collections/0',
            keyword: 'required',
            params: { missingProperty: 'files' },
          },
          { instancePath: '/collections/0/create', keyword: 'type', params: { type: 'boolean' } },
        ]),
      ).toEqual([
        'config.error_locator.collection collection=Blog: ' +
          'config.error.schema_invalid_type option=create ' +
          'type=config.error.schema_value_type.boolean',
      ]);
    });

    test('keeps locations that share a prefix but not a path', () => {
      const messages = report([
        {
          instancePath: '/collections/1',
          keyword: 'required',
          params: { missingProperty: 'files' },
        },
        {
          instancePath: '/collections/10',
          keyword: 'required',
          params: { missingProperty: 'files' },
        },
      ]);

      expect(messages).toHaveLength(2);
    });
  });
});
