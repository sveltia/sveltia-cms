import { describe, expect, test } from 'vitest';

import {
  isComplexListField,
  normalizeFieldName,
} from '$lib/services/contents/fields/relation/helper/field-names';

describe('Test normalizeFieldName()', () => {
  test('should return field name as-is if already in template format', () => {
    expect(normalizeFieldName('{{name}}')).toBe('{{name}}');
    expect(normalizeFieldName('{{name.first}}')).toBe('{{name.first}}');
    expect(normalizeFieldName('{{cities.*.name}}')).toBe('{{cities.*.name}}');
  });

  test('should wrap plain field name in brackets', () => {
    expect(normalizeFieldName('name')).toBe('{{name}}');
    expect(normalizeFieldName('name.first')).toBe('{{name.first}}');
    expect(normalizeFieldName('email')).toBe('{{email}}');
  });

  test('should handle slug field specially to avoid confusion', () => {
    expect(normalizeFieldName('slug')).toBe('{{fields.slug}}');
  });

  test('should not modify already prefixed slug field', () => {
    expect(normalizeFieldName('{{slug}}')).toBe('{{slug}}');
    expect(normalizeFieldName('{{fields.slug}}')).toBe('{{fields.slug}}');
  });
});

describe('Test isComplexListField()', () => {
  test('should return false for undefined field config', () => {
    expect(isComplexListField(undefined)).toBe(false);
  });

  test('should return false for non-list field', () => {
    expect(isComplexListField({ widget: 'string', name: 'title' })).toBe(false);
  });

  test('should return false for simple list field without subfields', () => {
    expect(isComplexListField({ widget: 'list', name: 'tags' })).toBe(false);
  });

  test('should return false for single subfield list field (field property only)', () => {
    expect(
      isComplexListField({
        widget: 'list',
        name: 'items',
        field: { widget: 'string', name: 'item' },
      }),
    ).toBe(false);
  });

  test('should return true for list field with multiple fields (fields property)', () => {
    expect(
      isComplexListField({
        widget: 'list',
        name: 'items',
        fields: [
          { widget: 'string', name: 'title' },
          { widget: 'string', name: 'description' },
        ],
      }),
    ).toBe(true);
  });

  test('should return true for list field with types', () => {
    expect(
      isComplexListField({
        widget: 'list',
        name: 'items',
        types: [{ label: 'Type A', widget: 'object', name: 'typeA', fields: [] }],
      }),
    ).toBe(true);
  });
});
