import { describe, expect, test } from 'vitest';

import { GET_DEFAULT_VALUE_MAP_FUNCTIONS } from './defaults';

describe('Test GET_DEFAULT_VALUE_MAP_FUNCTIONS', () => {
  test('should contain all field types', () => {
    const expectedFieldTypes = [
      'boolean',
      'code',
      'datetime',
      'file',
      'hidden',
      'image',
      'keyvalue',
      'list',
      'markdown',
      'number',
      'object',
      'relation',
      'richtext',
      'select',
    ];

    expectedFieldTypes.forEach((fieldType) => {
      expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS).toHaveProperty(fieldType);
      expect(typeof GET_DEFAULT_VALUE_MAP_FUNCTIONS[fieldType]).toBe('function');
    });
  });

  test('should map image field type to file field type handler', () => {
    expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS.image).toBe(GET_DEFAULT_VALUE_MAP_FUNCTIONS.file);
  });

  test('should map relation field type to select field type handler', () => {
    expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS.relation).toBe(GET_DEFAULT_VALUE_MAP_FUNCTIONS.select);
  });

  test('should map markdown field type to richtext field type handler', () => {
    expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS.markdown).toBe(GET_DEFAULT_VALUE_MAP_FUNCTIONS.richtext);
  });

  test('should have function values for all field types', () => {
    Object.entries(GET_DEFAULT_VALUE_MAP_FUNCTIONS).forEach(([, func]) => {
      expect(typeof func).toBe('function');
    });
  });

  test('should return expected number of field types', () => {
    // 14 total: boolean, code, datetime, file, hidden, image (alias), keyvalue, list,
    // markdown (alias), number, object, relation (alias), richtext, select
    expect(Object.keys(GET_DEFAULT_VALUE_MAP_FUNCTIONS)).toHaveLength(14);
  });

  test('should not contain string or text field types (handled as default)', () => {
    expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS).not.toHaveProperty('string');
    expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS).not.toHaveProperty('text');
  });

  test('should not contain compute field type (handled separately)', () => {
    expect(GET_DEFAULT_VALUE_MAP_FUNCTIONS).not.toHaveProperty('compute');
  });
});
