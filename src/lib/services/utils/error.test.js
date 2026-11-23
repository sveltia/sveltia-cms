import { describe, expect, test } from 'vitest';

import { describeError } from '$lib/services/utils/error';

describe('describeError()', () => {
  test('returns the message of an error', () => {
    expect(describeError(new TypeError('x is not a function'))).toBe('x is not a function');
  });

  test('stringifies any other thrown value', () => {
    expect(describeError('oops')).toBe('oops');
    expect(describeError(42)).toBe('42');
    expect(describeError(null)).toBe('');
    expect(describeError(undefined)).toBe('');
  });

  test('returns nothing for a value that can’t be stringified', () => {
    expect(describeError(Object.create(null))).toBe('');
  });
});
