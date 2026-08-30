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
