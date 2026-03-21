import { describe, expect, test } from 'vitest';

import { resolveCodeField } from './validate';

/**
 * @import { CodeField } from '$lib/types/public';
 */

/** @type {Pick<CodeField, 'widget' | 'name'>} */
const baseFieldConfig = /** @type {any} */ ({ widget: 'code', name: 'body' });

describe('resolveCodeField()', () => {
  test('resolves to the parent key when keyPath ends with default .code sub-key', () => {
    const result = resolveCodeField({
      keyPath: 'body.code',
      value: 'console.log()',
      valueMap: { 'body.code': 'console.log()' },
      fieldConfig: baseFieldConfig,
      validities: { _default: {} },
      locale: '_default',
    });

    expect(result.skip).toBe(false);
    expect(result.keyPath).toBe('body');
    expect(result.value).toBe('console.log()');
  });

  test('resolves to the parent key when keyPath ends with default .lang sub-key', () => {
    const result = resolveCodeField({
      keyPath: 'body.lang',
      value: 'javascript',
      valueMap: { 'body.code': 'console.log()' },
      fieldConfig: baseFieldConfig,
      validities: { _default: {} },
      locale: '_default',
    });

    expect(result.skip).toBe(false);
    expect(result.keyPath).toBe('body');
    expect(result.value).toBe('console.log()');
  });

  test('uses the keyPath as-is when it does not end with .code or .lang', () => {
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

  test('returns skip=true when resolvedKeyPath is already in validities', () => {
    const sentinelValidity = {};

    const result = resolveCodeField({
      keyPath: 'body.code',
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

  test('respects custom key names from fieldConfig.keys', () => {
    const fieldConfig = /** @type {any} */ ({
      ...baseFieldConfig,
      keys: { code: 'source', lang: 'language' },
    });

    const result = resolveCodeField({
      keyPath: 'snippet.source',
      value: 'console.log()',
      valueMap: { 'snippet.source': 'console.log()' },
      fieldConfig,
      validities: { _default: {} },
      locale: '_default',
    });

    expect(result.skip).toBe(false);
    expect(result.keyPath).toBe('snippet');
    expect(result.value).toBe('console.log()');
  });

  test('resolves lang sub-key with custom key names', () => {
    const fieldConfig = /** @type {any} */ ({
      ...baseFieldConfig,
      keys: { code: 'source', lang: 'language' },
    });

    const result = resolveCodeField({
      keyPath: 'snippet.language',
      value: 'js',
      valueMap: { 'snippet.source': 'alert()' },
      fieldConfig,
      validities: { _default: {} },
      locale: '_default',
    });

    expect(result.skip).toBe(false);
    expect(result.keyPath).toBe('snippet');
    expect(result.value).toBe('alert()');
  });
});
