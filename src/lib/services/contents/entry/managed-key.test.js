// @ts-nocheck
import { describe, expect, test } from 'vitest';

import { getManagedKey } from '$lib/services/contents/entry/managed-key';

describe('Test getManagedKey()', () => {
  const baseArgs = { collection: { _type: 'entry' }, defaultKey: 'foo' };

  test('should return the default key when the option is `true`', () => {
    expect(getManagedKey({ ...baseArgs, option: true })).toBe('foo');
  });

  test('should return the option value when it’s a string', () => {
    expect(getManagedKey({ ...baseArgs, option: 'bar' })).toBe('bar');
  });

  test('should return `undefined` when the option is empty', () => {
    expect(getManagedKey({ ...baseArgs, option: false })).toBeUndefined();
    expect(getManagedKey({ ...baseArgs, option: '' })).toBeUndefined();
    expect(getManagedKey(baseArgs)).toBeUndefined();
  });

  test('should return `undefined` for anything but an entry collection', () => {
    expect(getManagedKey({ ...baseArgs, collection: { _type: 'file' }, option: true })).toBe(
      undefined,
    );
    expect(getManagedKey({ ...baseArgs, collection: undefined, option: true })).toBe(undefined);
  });

  test('should return `undefined` when a field with the same name is configured', () => {
    expect(getManagedKey({ ...baseArgs, option: true, fields: [{ name: 'foo' }] })).toBeUndefined();
  });
});
