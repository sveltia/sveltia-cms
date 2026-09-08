import { describe, expect, test, vi } from 'vitest';

import { prepareSchema } from '$lib/services/config/schema/transform';

import { validateConfigSchema } from '.';

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

/**
 * Adapt a published schema into the pair of variants the validator uses, the way the loader does.
 * @param {Record<string, any>} publishedSchema Schema to adapt.
 * @returns {any} Schemas.
 */
const prepare = (publishedSchema) => ({
  strict: prepareSchema(publishedSchema),
  lenient: prepareSchema(publishedSchema, { allowUnknownProperties: true }),
});

const schemas = prepare({
  type: 'object',
  additionalProperties: false,
  properties: { media_folder: { type: 'string' } },
  required: ['media_folder'],
});

/**
 * Validate the given configuration and collect the messages.
 * @param {any} config Configuration.
 * @param {any} [schemasToUse] Schemas to validate against.
 * @returns {{ errors: string[], warnings: string[] }} Messages, by collector.
 */
const collect = (config, schemasToUse = schemas) => {
  /** @type {any} */
  const collectors = { errors: new Set(), warnings: new Set() };

  validateConfigSchema({ config, schemas: schemasToUse, collectors });

  return { errors: [...collectors.errors], warnings: [...collectors.warnings] };
};

/**
 * Validate the given configuration and collect the errors.
 * @param {any} config Configuration.
 * @param {any} [schemasToUse] Schemas to validate against.
 * @returns {string[]} Errors.
 */
const validate = (config, schemasToUse = schemas) => collect(config, schemasToUse).errors;

describe('config/schema/index', () => {
  describe('validateConfigSchema', () => {
    test('accepts a valid configuration', () => {
      expect(validate({ media_folder: 'static' })).toEqual([]);
    });

    test('accepts unknown options', () => {
      expect(validate({ media_folder: 'static', local_backend: true })).toEqual([]);
    });

    test('reports a violation', () => {
      expect(validate({ media_folder: 42 })).toEqual([
        'config.error.schema_invalid_type option=media_folder ' +
          'type=config.error.schema_value_type.string',
      ]);
    });

    test('skips validation without a schema', () => {
      /** @type {any} */
      const collectors = { errors: new Set(), warnings: new Set() };

      validateConfigSchema({
        config: /** @type {any} */ ({ media_folder: 42 }),
        schemas: undefined,
        collectors,
      });

      expect([...collectors.errors]).toEqual([]);
    });

    test('validates a custom field type against its registered schema', async () => {
      const { customFieldTypeRegistry } = await import('$lib/services/api/registries');

      customFieldTypeRegistry.set('rating', {
        /**
         * Stand-in control component.
         * @returns {undefined} Nothing.
         */
        control: () => undefined,
        schema: { properties: { max: { type: 'integer' } } },
      });

      const fieldSchemas = prepare({
        type: 'object',
        properties: { custom: { $ref: '#/definitions/CustomField' } },
        definitions: {
          CustomField: {
            type: 'object',
            additionalProperties: false,
            properties: { name: { type: 'string' }, widget: { type: 'string' } },
          },
        },
      });

      expect(validate({ custom: { name: 'a', widget: 'rating', max: 5 } }, fieldSchemas)).toEqual(
        [],
      );

      expect(
        validate({ custom: { name: 'a', widget: 'rating', max: 'five' } }, fieldSchemas),
      ).toEqual([
        'config.error.schema_invalid_type option=custom.max ' +
          'type=config.error.schema_value_type.integer',
      ]);

      // Another field type is unaffected by the registration
      expect(
        validate({ custom: { name: 'a', widget: 'other', max: 'five' } }, fieldSchemas),
      ).toEqual([]);

      customFieldTypeRegistry.clear();
    });

    test('accepts a regular expression object where a pattern is expected', () => {
      const patternSchemas = prepare({
        type: 'object',
        properties: {
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'array',
                  items: [
                    { anyOf: [{ type: 'string' }, { type: 'string', format: 'regex' }] },
                    { type: 'string' },
                  ],
                },
              },
            },
          },
        },
      });

      // A configuration file can only hold a pattern as a string
      expect(
        validate({ fields: [{ pattern: ['^\\d{4}$', 'Four digits'] }] }, patternSchemas),
      ).toEqual([]);

      // While the JS API also accepts a `RegExp` object
      expect(
        validate({ fields: [{ pattern: [/^\d{4}$/, 'Four digits'] }] }, patternSchemas),
      ).toEqual([]);

      // Anything else is still a violation
      expect(validate({ fields: [{ pattern: [42, 'Four digits'] }] }, patternSchemas)).toEqual([
        'config.error.schema_invalid_type option=pattern[0] ' +
          'type=config.error.schema_value_type.string',
      ]);
    });

    describe('a union of a primitive and an object', () => {
      // Modelled on the collection `index_file` option, which is a boolean or a set of options.
      // Such a union can’t be reduced to a single branch, so every branch is validated and an
      // unknown property in the object one used to leave the primitive branch as the only match.
      const unionSchemas = prepare({
        type: 'object',
        additionalProperties: false,
        properties: { index_file: { anyOf: [{ type: 'boolean' }, { $ref: '#/definitions/I' }] } },
        definitions: {
          I: {
            type: 'object',
            additionalProperties: false,
            properties: {
              name: { type: 'string' },
              editor: {
                type: 'object',
                additionalProperties: false,
                properties: { preview: { type: 'boolean' } },
              },
              fields: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: { name: { type: 'string' }, widget: { type: 'string' } },
                },
              },
            },
          },
        },
      });

      test('accepts the object branch', () => {
        expect(
          collect({ index_file: { name: '_index', fields: [{ name: 'title' }] } }, unionSchemas),
        ).toEqual({ errors: [], warnings: [] });
      });

      test('warns about an unknown option instead of rejecting the branch', () => {
        expect(collect({ index_file: { name: '_index', i18n: true } }, unionSchemas)).toEqual({
          errors: [],
          warnings: ['config.warning.schema_unknown_option option=index_file.i18n'],
        });
      });

      test('warns about an unknown option nested in the branch', () => {
        expect(collect({ index_file: { editor: { previewz: false } } }, unionSchemas)).toEqual({
          errors: [],
          warnings: ['config.warning.schema_unknown_option option=index_file.editor.previewz'],
        });
      });

      test('warns about an unknown option of an item within the branch', () => {
        expect(
          collect({ index_file: { fields: [{ name: 'title', bogus: 1 }] } }, unionSchemas),
        ).toEqual({
          errors: [],
          warnings: ['config.warning.schema_unknown_option option=index_file.fields[0].bogus'],
        });
      });

      test('still reports a violation within the branch', () => {
        expect(collect({ index_file: { name: 42 } }, unionSchemas)).toEqual({
          errors: [
            'config.error.schema_invalid_type option=index_file.name ' +
              'type=config.error.schema_value_type.string',
          ],
          warnings: [],
        });
      });

      test('reports a violation and an unknown option together', () => {
        expect(collect({ index_file: { name: 42, i18n: true } }, unionSchemas)).toEqual({
          errors: [
            'config.error.schema_invalid_type option=index_file.name ' +
              'type=config.error.schema_value_type.string',
          ],
          warnings: ['config.warning.schema_unknown_option option=index_file.i18n'],
        });
      });

      test('still reports a value that matches no branch', () => {
        expect(collect({ index_file: '_index' }, unionSchemas)).toEqual({
          errors: [
            'config.error.schema_invalid_type option=index_file ' +
              'type=config.error.schema_value_type.boolean or config.error.schema_value_type.object',
          ],
          warnings: [],
        });
      });
    });

    test('skips validation when the schema cannot be used', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      // A reference that goes nowhere is rejected by the validator
      expect(validate({}, prepare({ $ref: '#/definitions/Missing' }))).toEqual([]);
      expect(warn).toHaveBeenCalled();

      warn.mockRestore();
    });
  });
});
