import { describe, expect, test } from 'vitest';

import {
  INTERNAL_PROP_PREFIX,
  isInternalPropKey,
} from '$lib/services/contents/fields/internal-props';

describe('INTERNAL_PROP_PREFIX', () => {
  test('is the prefix of the internal properties', () => {
    expect(INTERNAL_PROP_PREFIX).toBe('__sc_');
  });
});

describe('isInternalPropKey', () => {
  test('matches a name with the prefix', () => {
    expect(isInternalPropKey('__sc_item_id')).toBe(true);
    expect(isInternalPropKey('__sc_component_name')).toBe(true);
  });

  test('does not match any other name', () => {
    expect(isInternalPropKey('title')).toBe(false);
    expect(isInternalPropKey('item__sc_id')).toBe(false);
    expect(isInternalPropKey('')).toBe(false);
  });
});
