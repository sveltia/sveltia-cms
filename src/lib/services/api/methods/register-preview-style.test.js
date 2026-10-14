import { beforeEach, describe, expect, test } from 'vitest';

// @ts-ignore
global.window = { location: /** @type {Location} */ ({ href: 'https://sveltia.dev/admin/' }) };

const { customPreviewStyleRegistry } = await import('$lib/services/api/registries');
const { registerPreviewStyle } = await import('$lib/services/api/methods/register-preview-style');

describe('CMS.registerPreviewStyle()', () => {
  beforeEach(() => {
    customPreviewStyleRegistry.clear();
  });

  test('registers stylesheet URL', () => {
    expect(() => registerPreviewStyle('https://example.com/style.css')).not.toThrow();
    expect([...customPreviewStyleRegistry].map(({ url }) => url)).toContain(
      'https://example.com/style.css',
    );
  });

  test('registers stylesheet file path', () => {
    expect(() => registerPreviewStyle('/assets/style.css')).not.toThrow();
    expect([...customPreviewStyleRegistry].map(({ url }) => url)).toContain(
      'https://sveltia.dev/assets/style.css',
    );
  });

  test('registers raw CSS string', () => {
    expect(() => registerPreviewStyle('body { color: red; }', { raw: true })).not.toThrow();
    expect(customPreviewStyleRegistry.size).toBe(1);
    expect([...customPreviewStyleRegistry][0].url).toMatch(/^blob:/);
  });

  test('throws TypeError if non-raw style is not a valid URL or file path', () => {
    expect(() => registerPreviewStyle('http://')).toThrow(TypeError);
  });

  test('throws with proper error message for invalid non-raw style', () => {
    expect(() => registerPreviewStyle('http://')).toThrow(
      'The `style` option for `CMS.registerPreviewStyle()` must be a valid URL or file path when `raw` is false',
    );
  });

  test('throws TypeError if style is not a non-empty string', () => {
    // @ts-ignore
    expect(() => registerPreviewStyle(123)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerPreviewStyle(null)).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerPreviewStyle({})).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerPreviewStyle('   ')).toThrow(TypeError);
  });

  test('throws with proper error message for invalid style', () => {
    // @ts-ignore
    expect(() => registerPreviewStyle(123)).toThrow(
      'The `style` option for `CMS.registerPreviewStyle()` must be a non-empty string',
    );
  });

  test('throws TypeError if raw option is not a boolean', () => {
    // @ts-ignore
    expect(() => registerPreviewStyle('body {}', { raw: 'true' })).toThrow(TypeError);
    // @ts-ignore
    expect(() => registerPreviewStyle('body {}', { raw: 1 })).toThrow(TypeError);
  });

  test('throws with proper error message for invalid raw option', () => {
    // @ts-ignore
    expect(() => registerPreviewStyle('body {}', { raw: 'true' })).toThrow(
      'The `raw` option for `CMS.registerPreviewStyle()` must be a boolean',
    );
  });

  test('defaults raw option to false', () => {
    expect(() => registerPreviewStyle('https://example.com/style.css')).not.toThrow();
  });

  test('registers stylesheet for all collections by default', () => {
    registerPreviewStyle('https://example.com/style.css');
    expect([...customPreviewStyleRegistry]).toEqual([
      { url: 'https://example.com/style.css', collection: undefined, file: undefined },
    ]);
  });

  test('registers stylesheet for a collection', () => {
    registerPreviewStyle('https://example.com/style.css', { collection: 'posts' });
    expect([...customPreviewStyleRegistry]).toEqual([
      { url: 'https://example.com/style.css', collection: 'posts', file: undefined },
    ]);
  });

  test('registers stylesheet for a file in a file/singleton collection', () => {
    registerPreviewStyle('https://example.com/style.css', {
      collection: '_singletons',
      file: 'about',
    });
    expect([...customPreviewStyleRegistry]).toEqual([
      { url: 'https://example.com/style.css', collection: '_singletons', file: 'about' },
    ]);
  });

  test('registers the same stylesheet once per scope', () => {
    registerPreviewStyle('https://example.com/style.css');
    registerPreviewStyle('https://example.com/style.css');
    registerPreviewStyle('https://example.com/style.css', { collection: 'posts' });
    registerPreviewStyle('https://example.com/style.css', { collection: 'posts' });
    registerPreviewStyle('https://example.com/style.css', { collection: 'pages' });
    registerPreviewStyle('https://example.com/style.css', {
      collection: 'pages',
      file: 'about',
    });
    expect(customPreviewStyleRegistry.size).toBe(4);
  });

  test('throws TypeError if collection option is not a non-empty string', () => {
    // @ts-ignore
    expect(() => registerPreviewStyle('body {}', { raw: true, collection: 1 })).toThrow(
      'The `collection` option for `CMS.registerPreviewStyle()` must be a non-empty string',
    );
    expect(() => registerPreviewStyle('body {}', { raw: true, collection: ' ' })).toThrow(
      TypeError,
    );
    expect(customPreviewStyleRegistry.size).toBe(0);
  });

  test('throws TypeError if file option is not a non-empty string', () => {
    expect(() =>
      // @ts-ignore
      registerPreviewStyle('body {}', { raw: true, collection: 'pages', file: 1 }),
    ).toThrow('The `file` option for `CMS.registerPreviewStyle()` must be a non-empty string');
    expect(() =>
      registerPreviewStyle('body {}', { raw: true, collection: 'pages', file: '' }),
    ).toThrow(TypeError);
    expect(customPreviewStyleRegistry.size).toBe(0);
  });

  test('throws TypeError if file option is given without collection option', () => {
    expect(() => registerPreviewStyle('body {}', { raw: true, file: 'about' })).toThrow(
      'The `file` option for `CMS.registerPreviewStyle()` requires the `collection` option',
    );
    expect(customPreviewStyleRegistry.size).toBe(0);
  });
});
