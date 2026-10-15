import { describe, expect, test } from 'vitest';

import {
  DEFAULT_IDENTIFIER_FIELD,
  getIdentifierFieldName,
} from '$lib/services/contents/collection/identifier';

describe('getIdentifierFieldName()', () => {
  test('returns the `identifier_field` option', () => {
    expect(getIdentifierFieldName({ identifier_field: 'name' })).toBe('name');
  });

  test('defaults to `title`', () => {
    expect(DEFAULT_IDENTIFIER_FIELD).toBe('title');
    expect(getIdentifierFieldName({})).toBe('title');
    expect(getIdentifierFieldName(undefined)).toBe('title');
  });
});
