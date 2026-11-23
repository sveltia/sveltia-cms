import { describe, expect, test } from 'vitest';

import {
  BUILTIN_FIELD_TYPES,
  MEDIA_FIELD_TYPES,
  MIN_MAX_VALUE_FIELD_TYPES,
  MULTI_VALUE_FIELD_TYPES,
  RICH_TEXT_FIELD_TYPES,
  STRING_VALUE_FIELD_TYPES,
  TEXT_FIELD_TYPES,
} from '$lib/services/contents/fields';

describe('field type lists', () => {
  test('list each built-in field type once', () => {
    expect(new Set(BUILTIN_FIELD_TYPES).size).toBe(BUILTIN_FIELD_TYPES.length);
  });

  test('only contain built-in field types', () => {
    [
      MEDIA_FIELD_TYPES,
      MIN_MAX_VALUE_FIELD_TYPES,
      MULTI_VALUE_FIELD_TYPES,
      RICH_TEXT_FIELD_TYPES,
      STRING_VALUE_FIELD_TYPES,
      TEXT_FIELD_TYPES,
    ].forEach((types) => {
      expect(BUILTIN_FIELD_TYPES).toEqual(expect.arrayContaining(types));
      expect(new Set(types).size).toBe(types.length);
    });
  });

  test('exclude the types with a non-string value from the string value types', () => {
    expect(STRING_VALUE_FIELD_TYPES).toEqual([
      'color',
      'compute',
      'datetime',
      'map',
      'markdown',
      'richtext',
      'string',
      'text',
      'uuid',
    ]);
  });

  test('treat every rich text type as a text type', () => {
    expect(TEXT_FIELD_TYPES).toEqual(['text', 'string', 'richtext', 'markdown']);
  });

  test('let the multi-value types use the `min` and `max` options', () => {
    expect(MULTI_VALUE_FIELD_TYPES).toEqual(['file', 'image', 'relation', 'select']);
    expect(MIN_MAX_VALUE_FIELD_TYPES).toEqual(expect.arrayContaining(MULTI_VALUE_FIELD_TYPES));
    expect(MIN_MAX_VALUE_FIELD_TYPES).toEqual(
      expect.arrayContaining(['datetime', 'keyvalue', 'list', 'number']),
    );
  });
});
