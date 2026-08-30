// `then` is a JSON Schema keyword, not a promise callback
/* oxlint-disable unicorn/no-thenable */
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { customFieldTypeRegistry } from '$lib/services/api/registries';

import { applyCustomFieldSchemas } from './custom-fields';

/**
 * A stand-in for the published schema, holding only what the function touches.
 * @returns {Record<string, any>} Schema.
 */
const baseSchema = () => ({
  $ref: '#/definitions/CmsConfig',
  definitions: {
    CmsConfig: { type: 'object' },
    CustomField: { type: 'object', properties: { name: { type: 'string' } } },
  },
});

/**
 * Register a field type with the given schema.
 * @param {string} name Field type name.
 * @param {any} [schema] Field schema.
 */
const register = (name, schema) => {
  customFieldTypeRegistry.set(name, {
    /**
     * Stand-in control component.
     * @returns {undefined} Nothing.
     */
    control: () => undefined,
    schema,
  });
};

describe('config/schema/custom-fields', () => {
  beforeEach(() => {
    customFieldTypeRegistry.clear();
    vi.restoreAllMocks();
  });

  test('leaves the schema alone when no field type has been registered', () => {
    const schema = baseSchema();

    expect(applyCustomFieldSchemas(schema)).toBe(schema);
  });

  test('leaves the schema alone when no registered field type has a schema', () => {
    register('plain');

    const schema = baseSchema();

    expect(applyCustomFieldSchemas(schema)).toBe(schema);
  });

  test('applies a registered schema to the fields using that type', () => {
    const fieldSchema = { properties: { separator: { type: 'string' } }, required: ['separator'] };

    register('array', fieldSchema);

    const schema = baseSchema();
    const { definitions } = applyCustomFieldSchemas(schema);

    expect(definitions.CustomField).toEqual({
      allOf: [
        schema.definitions.CustomField,
        {
          if: { required: ['widget'], properties: { widget: { const: 'array' } } },
          then: fieldSchema,
        },
      ],
    });
    // The schema passed in is left untouched, so a later load starts from the published version
    expect(schema.definitions.CustomField).not.toHaveProperty('allOf');
  });

  test('applies one conditional schema per registered field type', () => {
    register('array', { properties: { separator: { type: 'string' } } });
    register('plain');
    register('rating', { properties: { max: { type: 'integer' } } });

    const { definitions } = applyCustomFieldSchemas(baseSchema());

    expect(definitions.CustomField.allOf).toHaveLength(3);
    expect(
      definitions.CustomField.allOf
        .slice(1)
        .map((/** @type {Record<string, any>} */ entry) => entry.then),
    ).toEqual([
      { properties: { separator: { type: 'string' } } },
      { properties: { max: { type: 'integer' } } },
    ]);
  });

  test('ignores an additionalProperties restriction in a registered schema', () => {
    register('array', {
      properties: { separator: { type: 'string' } },
      additionalProperties: false,
    });

    const { definitions } = applyCustomFieldSchemas(baseSchema());

    // Left in place, it would reject the common options every field has, such as `name`
    expect(definitions.CustomField.allOf[1].then).toEqual({
      properties: { separator: { type: 'string' } },
    });
  });

  test('drops a schema that can’t be compiled, naming the field type', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    // `int` is not a JSON Schema type
    register('broken', { properties: { max: { type: 'int' } } });
    register('rating', { properties: { max: { type: 'integer' } } });

    const { definitions } = applyCustomFieldSchemas(baseSchema());

    // One bad registration doesn’t stop the others from being applied
    expect(definitions.CustomField.allOf).toHaveLength(2);
    expect(definitions.CustomField.allOf[1].if.properties.widget.const).toBe('rating');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('`broken` field type'));
  });

  test('leaves the schema alone when it has no custom field definition', () => {
    register('array', { properties: { separator: { type: 'string' } } });

    const schema = { definitions: { CmsConfig: { type: 'object' } } };

    expect(applyCustomFieldSchemas(schema)).toBe(schema);
  });
});
