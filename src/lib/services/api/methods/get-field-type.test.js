/* eslint-disable jsdoc/require-jsdoc */

import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('$lib/services/api/field-types', () => ({
  getFieldTypeDefinition: vi.fn(),
}));

const { getFieldTypeDefinition } = await import('$lib/services/api/field-types');
const { getFieldType } = await import('$lib/services/api/methods/get-field-type');

describe('CMS.getFieldType()', () => {
  beforeEach(() => {
    vi.mocked(getFieldTypeDefinition).mockReset();
  });

  test('returns the field type definition for the given name', () => {
    const definition = { control: () => null, preview: () => null };

    // @ts-ignore
    vi.mocked(getFieldTypeDefinition).mockReturnValue(definition);

    expect(getFieldType('select')).toBe(definition);
    expect(getFieldTypeDefinition).toHaveBeenCalledExactlyOnceWith('select');
  });

  test('returns undefined for an unavailable field type', () => {
    vi.mocked(getFieldTypeDefinition).mockReturnValue(undefined);

    expect(getFieldType('list')).toBeUndefined();
  });

  test('throws TypeError for an invalid name', () => {
    // @ts-ignore
    expect(() => getFieldType()).toThrow(TypeError);
    expect(() => getFieldType('')).toThrow(TypeError);
    // @ts-ignore
    expect(() => getFieldType(123)).toThrow(TypeError);
    expect(getFieldTypeDefinition).not.toHaveBeenCalled();
  });
});
