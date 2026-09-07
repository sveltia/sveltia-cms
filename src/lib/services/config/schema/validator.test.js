import { describe, expect, test } from 'vitest';

import { compileSchema } from './validator';

describe('config/schema/validator', () => {
  test('reports nothing for a valid configuration', () => {
    const validate = compileSchema({ type: 'object', properties: { a: { type: 'string' } } });

    expect(validate({ a: 'x' })).toEqual([]);
  });

  test('reads the expected type back from the schema', () => {
    const validate = compileSchema({ type: 'object', properties: { a: { type: 'integer' } } });

    expect(validate({ a: 'x' })).toEqual([
      { instancePath: '/a', keyword: 'type', params: { type: 'integer' } },
    ]);
  });

  test('reads the allowed values back from the schema', () => {
    const validate = compileSchema({
      type: 'object',
      properties: { a: { enum: ['x', 'y'] }, b: { const: 'z' }, c: { minItems: 2, type: 'array' } },
    });

    expect(validate({ a: 'q', b: 'q', c: [1] })).toEqual(
      expect.arrayContaining([
        { instancePath: '/a', keyword: 'enum', params: { allowedValues: ['x', 'y'] } },
        { instancePath: '/b', keyword: 'const', params: { allowedValue: 'z' } },
        { instancePath: '/c', keyword: 'minItems', params: { limit: 2 } },
      ]),
    );
  });

  test('reports one error per missing required property', () => {
    const validate = compileSchema({ type: 'object', required: ['a', 'b', 'c'] });

    expect(validate({ b: 1 })).toEqual([
      { instancePath: '', keyword: 'required', params: { missingProperty: 'a' } },
      { instancePath: '', keyword: 'required', params: { missingProperty: 'c' } },
    ]);
  });

  test('follows references when reading a constraint back', () => {
    const validate = compileSchema({
      $ref: '#/definitions/Root',
      definitions: {
        Root: { type: 'object', properties: { a: { $ref: '#/definitions/Count' } } },
        Count: { type: 'integer' },
      },
    });

    expect(validate({ a: 'x' })).toEqual([
      { instancePath: '/a', keyword: 'type', params: { type: 'integer' } },
    ]);
  });

  test('drops the keywords that only report a failure below them', () => {
    const validate = compileSchema({
      type: 'object',
      properties: { a: { type: 'object', properties: { b: { type: 'string' } } } },
    });

    // Without the filter this would also carry `properties` errors for the object and its parent
    expect(validate({ a: { b: 1 } })).toEqual([
      { instancePath: '/a/b', keyword: 'type', params: { type: 'string' } },
    ]);
  });

  test('keeps alternatives, which the reporter merges into one message', () => {
    const validate = compileSchema({
      type: 'object',
      properties: { a: { anyOf: [{ type: 'string' }, { type: 'boolean' }] } },
    });

    const errors = validate({ a: 1 });

    expect(errors.some(({ keyword }) => keyword === 'anyOf')).toBe(true);
    expect(
      errors.filter(({ keyword }) => keyword === 'type').map(({ params }) => params.type),
    ).toEqual(['string', 'boolean']);
  });

  test('decodes escaped pointer segments', () => {
    const validate = compileSchema({
      type: 'object',
      properties: { 'a/b': { type: 'string' } },
    });

    expect(validate({ 'a/b': 1 })).toEqual([
      { instancePath: '/a~1b', keyword: 'type', params: { type: 'string' } },
    ]);
  });

  test('names each property the schema doesn’t describe', () => {
    const validate = compileSchema({
      type: 'object',
      properties: { a: { type: 'string' } },
      additionalProperties: false,
    });

    expect(validate({ a: 'x', b: 1, c: 2 })).toEqual([
      { instancePath: '', keyword: 'additionalProperties', params: { additionalProperty: 'b' } },
      { instancePath: '', keyword: 'additionalProperties', params: { additionalProperty: 'c' } },
    ]);
  });

  // The validator rejects a known property whose value failed its own subschema with the same
  // boolean schema it uses for an unknown one, which would otherwise be reported as a typo
  test('doesn’t call a known property unknown when its value is invalid', () => {
    const validate = compileSchema({
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'object', required: ['c'] } },
      additionalProperties: false,
    });

    expect(validate({ a: 1, b: {} })).toEqual([
      { instancePath: '/a', keyword: 'type', params: { type: 'string' } },
      { instancePath: '/b', keyword: 'required', params: { missingProperty: 'c' } },
    ]);
  });

  test('reports an unknown property alongside an invalid one', () => {
    const validate = compileSchema({
      type: 'object',
      properties: { a: { type: 'string' } },
      additionalProperties: false,
    });

    expect(validate({ a: 1, b: 2 })).toEqual([
      { instancePath: '', keyword: 'additionalProperties', params: { additionalProperty: 'b' } },
      { instancePath: '/a', keyword: 'type', params: { type: 'string' } },
    ]);
  });

  test('decodes an escaped unknown property name', () => {
    const validate = compileSchema({ type: 'object', additionalProperties: false });

    expect(validate({ 'a/b': 1 })).toEqual([
      { instancePath: '', keyword: 'additionalProperties', params: { additionalProperty: 'a/b' } },
    ]);
  });

  test('resolves a nested object when listing its missing properties', () => {
    const validate = compileSchema({
      type: 'object',
      properties: { a: { type: 'object', required: ['b', 'c'] } },
    });

    expect(validate({ a: { c: 1 } })).toEqual([
      { instancePath: '/a', keyword: 'required', params: { missingProperty: 'b' } },
    ]);
  });
});
