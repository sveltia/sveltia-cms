/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, test, vi } from 'vitest';

const { registerCustomFormat } = await import('$lib/services/api/methods/register-custom-format');

describe('CMS.registerCustomFormat()', () => {
  test('registers format with both parser and formatter', () => {
    const fromFile = () => {};
    const toFile = () => {};

    // @ts-ignore
    expect(() => registerCustomFormat('test', '.test', { fromFile, toFile })).not.toThrow();
  });

  test('registers format with only parser, warning that its entries can’t be saved', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fromFile = () => {};

    expect(() => registerCustomFormat('test', '.test', { fromFile })).not.toThrow();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      'The custom “test” format has no `toFile` method, so its entries can’t be saved',
    );
    warnSpy.mockRestore();
  });

  test('registers format with only formatter, warning that its entries can’t be loaded', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const toFile = () => {};

    // @ts-ignore
    expect(() => registerCustomFormat('test', '.test', { toFile })).not.toThrow();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      'The custom “test” format has no `fromFile` method, so its entries can’t be loaded',
    );
    warnSpy.mockRestore();
  });

  test('does not warn about a missing method of a built-in format', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    registerCustomFormat('json', 'json', { fromFile: () => ({}) });
    // @ts-ignore
    registerCustomFormat('yaml-frontmatter', 'md', { toFile: () => '' });

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('throws TypeError if name is not a non-empty string', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => registerCustomFormat(123, '.test', { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerCustomFormat(null, '.test', { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerCustomFormat({}, '.test', { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerCustomFormat('   ', '.test', { toFile })).toThrow(TypeError);
  });

  test('throws with proper error message for invalid name', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => registerCustomFormat(123, '.test', { toFile })).toThrow(
      'The `name` option for `CMS.registerCustomFormat()` must be a non-empty string',
    );
  });

  test('throws TypeError if extension is not a non-empty string', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => registerCustomFormat('test', 123, { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerCustomFormat('test', null, { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerCustomFormat('test', {}, { toFile })).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerCustomFormat('test', '   ', { toFile })).toThrow(TypeError);
  });

  test('throws with proper error message for invalid extension', () => {
    const toFile = () => {};

    // @ts-ignore
    expect(() => registerCustomFormat('test', 123, { toFile })).toThrow(
      'The `extension` option for `CMS.registerCustomFormat()` must be a non-empty string',
    );
  });

  test('throws Error if neither fromFile nor toFile is provided', () => {
    expect(() => registerCustomFormat('test', '.test', {})).toThrow(Error);
    expect(() => registerCustomFormat('test', '.test')).toThrow(Error);
  });

  test('throws with proper error message for missing methods', () => {
    expect(() => registerCustomFormat('test', '.test', {})).toThrow(
      'At least one of `fromFile` or `toFile` must be provided to `CMS.registerCustomFormat()`',
    );
  });

  test('throws TypeError if fromFile is provided but not a function', () => {
    const toFile = () => {};

    expect(() =>
      // @ts-ignore
      registerCustomFormat('test', '.test', { fromFile: 'invalid', toFile }),
    ).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerCustomFormat('test', '.test', { fromFile: 123, toFile })).toThrow(
      TypeError,
    );
  });

  test('throws with proper error message for invalid fromFile', () => {
    const toFile = () => {};

    expect(() =>
      // @ts-ignore
      registerCustomFormat('test', '.test', { fromFile: 'invalid', toFile }),
    ).toThrow('The `fromFile` option for `CMS.registerCustomFormat()` must be a function');
  });

  test('throws TypeError if toFile is provided but not a function', () => {
    const fromFile = () => {};

    expect(() =>
      // @ts-ignore
      registerCustomFormat('test', '.test', { fromFile, toFile: 'invalid' }),
    ).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerCustomFormat('test', '.test', { fromFile, toFile: 123 })).toThrow(
      TypeError,
    );
  });

  test('throws with proper error message for invalid toFile', () => {
    const fromFile = () => {};

    expect(() =>
      // @ts-ignore
      registerCustomFormat('test', '.test', { fromFile, toFile: 'invalid' }),
    ).toThrow('The `toFile` option for `CMS.registerCustomFormat()` must be a function');
  });

  test('throws TypeError if the only method provided is not a function', () => {
    // @ts-ignore
    expect(() => registerCustomFormat('test', '.test', { fromFile: 'invalid' })).toThrow(
      'The `fromFile` option for `CMS.registerCustomFormat()` must be a function',
    );
    // @ts-ignore
    expect(() => registerCustomFormat('test', '.test', { toFile: 123 })).toThrow(TypeError);
  });

  test('accepts async functions as parser/formatter', () => {
    const asyncFromFile = async () => {};
    const asyncToFile = async () => {};

    expect(() =>
      // @ts-ignore
      registerCustomFormat('test', '.test', { fromFile: asyncFromFile, toFile: asyncToFile }),
    ).not.toThrow();
  });
});
