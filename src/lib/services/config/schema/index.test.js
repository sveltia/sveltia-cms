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

const schema = prepareSchema({
  type: 'object',
  additionalProperties: false,
  properties: { media_folder: { type: 'string' } },
  required: ['media_folder'],
});

/**
 * Validate the given configuration and collect the errors.
 * @param {any} config Configuration.
 * @param {any} [schemaToUse] Schema to validate against.
 * @returns {string[]} Errors.
 */
const validate = (config, schemaToUse = schema) => {
  /** @type {any} */
  const collectors = { errors: new Set(), warnings: new Set() };

  validateConfigSchema({ config, schema: schemaToUse, collectors });

  return [...collectors.errors];
};

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
        schema: undefined,
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

      const fieldSchema = prepareSchema({
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

      expect(validate({ custom: { name: 'a', widget: 'rating', max: 5 } }, fieldSchema)).toEqual(
        [],
      );

      expect(
        validate({ custom: { name: 'a', widget: 'rating', max: 'five' } }, fieldSchema),
      ).toEqual([
        'config.error.schema_invalid_type option=custom.max ' +
          'type=config.error.schema_value_type.integer',
      ]);

      // Another field type is unaffected by the registration
      expect(
        validate({ custom: { name: 'a', widget: 'other', max: 'five' } }, fieldSchema),
      ).toEqual([]);

      customFieldTypeRegistry.clear();
    });

    test('skips validation when the schema cannot be compiled', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(validate({}, { type: 'not-a-type' })).toEqual([]);
      expect(warn).toHaveBeenCalled();

      warn.mockRestore();
    });
  });
});
