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

    test('skips validation when the schema cannot be compiled', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      expect(validate({}, { type: 'not-a-type' })).toEqual([]);
      expect(warn).toHaveBeenCalled();

      warn.mockRestore();
    });
  });
});
