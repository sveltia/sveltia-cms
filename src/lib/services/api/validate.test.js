import { describe, expect, test } from 'vitest';

import {
  assertDefinition,
  assertNotReserved,
  assertOption,
  assertValid,
  parseURLFromPage,
} from '$lib/services/api/validate';

describe('assertValid()', () => {
  test('does nothing for a valid value', () => {
    expect(() => assertValid(true, 'Message')).not.toThrow();
  });

  test('throws a TypeError for an invalid value', () => {
    expect(() => assertValid(false, 'Message')).toThrow(TypeError);
    expect(() => assertValid(false, 'Message')).toThrow('Message');
  });
});

describe('assertOption()', () => {
  test('does nothing for a valid option', () => {
    expect(() => assertOption(true, 'init', 'config', 'an object')).not.toThrow();
  });

  test('names the option and the method', () => {
    expect(() => assertOption(false, 'init', 'config', 'an object')).toThrow(
      new TypeError('The `config` option for `CMS.init()` must be an object'),
    );
  });
});

describe('assertDefinition()', () => {
  test('does nothing for a valid property', () => {
    expect(() => assertDefinition(true, 'id', 'a string')).not.toThrow();
  });

  test('names the property', () => {
    expect(() => assertDefinition(false, 'id', 'a string')).toThrow(
      new TypeError('The `definition.id` must be a string'),
    );
  });
});

describe('assertNotReserved()', () => {
  const args = {
    reserved: ['string'],
    subject: 'field type',
    builtin: 'built-in field type',
    custom: 'custom field type',
  };

  test('accepts a name that is not reserved', () => {
    expect(() => assertNotReserved({ ...args, name: 'mine' })).not.toThrow();
  });

  test('rejects a reserved name', () => {
    expect(() => assertNotReserved({ ...args, name: 'string' })).toThrow(
      'The field type name "string" is reserved for a built-in field type. ' +
        'Choose a different name for your custom field type.',
    );
  });
});

global.window = /** @type {any} */ ({
  location: { href: 'https://sveltia.dev/admin/' },
});

describe('parseURLFromPage()', () => {
  test('resolves a relative path against the page', () => {
    expect(parseURLFromPage('/style.css')?.href).toBe('https://sveltia.dev/style.css');
  });

  test('keeps an absolute URL', () => {
    expect(parseURLFromPage('https://example.com/a')?.href).toBe('https://example.com/a');
  });

  test('returns `null` for an invalid URL', () => {
    expect(parseURLFromPage('http://')).toBeNull();
  });
});
