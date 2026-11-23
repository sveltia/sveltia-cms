import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getCodeField, resolveCodeField } from './validate';

/**
 * @import { CodeField } from '$lib/types/public';
 */

const mockGetField = vi.hoisted(() => vi.fn());

vi.mock('$lib/services/contents/entry/fields', () => ({ getField: mockGetField }));

/** @type {Pick<CodeField, 'widget' | 'name'>} */
const baseFieldConfig = /** @type {any} */ ({ widget: 'code', name: 'body' });

describe('getCodeField()', () => {
  const getFieldArgs = { collectionName: 'posts', keyPath: '', valueMap: {} };

  beforeEach(() => {
    mockGetField.mockReset();
  });

  test('returns the Code field the code or language belongs to', () => {
    const fieldConfig = { widget: 'code', name: 'snippet' };

    mockGetField.mockImplementation(({ keyPath }) =>
      keyPath === 'obj.snippet' ? fieldConfig : undefined,
    );

    expect(getCodeField({ ...getFieldArgs, keyPath: 'obj.snippet.code' })).toBe(fieldConfig);
    expect(getCodeField({ ...getFieldArgs, keyPath: 'obj.snippet.lang' })).toBe(fieldConfig);
    expect(getCodeField({ ...getFieldArgs, keyPath: 'obj.snippet.other' })).toBeUndefined();
    expect(mockGetField).toHaveBeenCalledWith(
      expect.objectContaining({ collectionName: 'posts', keyPath: 'obj.snippet' }),
    );
  });

  test('respects custom key names', () => {
    const fieldConfig = { widget: 'code', name: 'snippet', keys: { code: 'src', lang: 'lng' } };

    mockGetField.mockReturnValue(fieldConfig);

    expect(getCodeField({ ...getFieldArgs, keyPath: 'snippet.src' })).toBe(fieldConfig);
    expect(getCodeField({ ...getFieldArgs, keyPath: 'snippet.lng' })).toBe(fieldConfig);
    expect(getCodeField({ ...getFieldArgs, keyPath: 'snippet.code' })).toBeUndefined();
  });

  test('returns `undefined` for a field storing only the code', () => {
    mockGetField.mockReturnValue({ widget: 'code', name: 'snippet', output_code_only: true });

    expect(getCodeField({ ...getFieldArgs, keyPath: 'snippet.code' })).toBeUndefined();
  });

  test('returns `undefined` when the parent isn’t a Code field', () => {
    mockGetField.mockReturnValue({ widget: 'object', name: 'obj' });

    expect(getCodeField({ ...getFieldArgs, keyPath: 'obj.code' })).toBeUndefined();
  });

  test('returns `undefined` for a top-level key path', () => {
    expect(getCodeField({ ...getFieldArgs, keyPath: 'code' })).toBeUndefined();
    expect(mockGetField).not.toHaveBeenCalled();
  });
});

describe('resolveCodeField()', () => {
  test('uses the keyPath as is', () => {
    const result = resolveCodeField({
      keyPath: 'body',
      value: 'hello',
      valueMap: { 'body.code': 'hello' },
      fieldConfig: baseFieldConfig,
      validities: { _default: {} },
      locale: '_default',
    });

    expect(result.skip).toBe(false);
    expect(result.keyPath).toBe('body');
    expect(result.value).toBe('hello');
  });

  test('returns skip=true when keyPath is already in validities', () => {
    const sentinelValidity = {};

    const result = resolveCodeField({
      keyPath: 'body',
      value: 'x',
      valueMap: {},
      fieldConfig: baseFieldConfig,
      validities: { _default: { body: /** @type {any} */ (sentinelValidity) } },
      locale: '_default',
    });

    expect(result.skip).toBe(true);
    expect(result.keyPath).toBe('body');
  });

  test('preserves value when outputCodeOnly is true', () => {
    const fieldConfig = /** @type {any} */ ({
      ...baseFieldConfig,
      output_code_only: true,
    });

    const result = resolveCodeField({
      keyPath: 'body',
      value: 'my code',
      valueMap: { 'body.code': 'should not be used' },
      fieldConfig,
      validities: { _default: {} },
      locale: '_default',
    });

    expect(result.skip).toBe(false);
    expect(result.value).toBe('my code');
  });

  test('reads code value from valueMap when outputCodeOnly is false (default)', () => {
    const result = resolveCodeField({
      keyPath: 'body',
      value: 'raw',
      valueMap: { 'body.code': 'from map' },
      fieldConfig: baseFieldConfig,
      validities: { _default: {} },
      locale: '_default',
    });

    expect(result.value).toBe('from map');
  });

  test('reads the code value with a custom key name', () => {
    const fieldConfig = /** @type {any} */ ({
      ...baseFieldConfig,
      keys: { code: 'source', lang: 'language' },
    });

    const result = resolveCodeField({
      keyPath: 'snippet',
      value: undefined,
      valueMap: { 'snippet.source': 'alert()', 'snippet.language': 'js' },
      fieldConfig,
      validities: { _default: {} },
      locale: '_default',
    });

    expect(result).toEqual({ skip: false, keyPath: 'snippet', value: 'alert()' });
  });

  test('keeps the key path of a field named like a sub-key, e.g. `obj.code`', () => {
    const fieldConfig = /** @type {any} */ ({
      widget: 'code',
      name: 'code',
      output_code_only: true,
    });

    const result = resolveCodeField({
      keyPath: 'obj.code',
      value: 'alert()',
      valueMap: { 'obj.code': 'alert()' },
      fieldConfig,
      validities: { _default: {} },
      locale: '_default',
    });

    expect(result).toEqual({ skip: false, keyPath: 'obj.code', value: 'alert()' });
  });
});
