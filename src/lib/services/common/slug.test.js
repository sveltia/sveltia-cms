import { writable } from 'svelte/store';
import { describe, expect, test, vi } from 'vitest';

import { slugify } from '$lib/services/common/slug';

vi.mock('$lib/services/config');
vi.mock('$lib/services/contents/collection/entries', () => ({
  getEntriesByCollection: vi.fn(() => []),
}));
vi.mock('$lib/services/contents/entry/fields', () => ({
  getField: vi.fn(() => null),
}));
vi.mock('$lib/services/contents/entry/summary', () => ({
  getEntrySummaryFromContent: vi.fn(() => 'summary'),
}));
vi.mock('$lib/services/utils/file', () => ({
  renameIfNeeded: vi.fn((slug) => slug),
}));

describe('Test slugify()', () => {
  test('basic slugification with default settings', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('Hello   World')).toBe('hello-world'); // Multiple spaces
    expect(slugify('  Hello World  ')).toBe('hello-world'); // Leading/trailing spaces
    expect(slugify('HELLO WORLD')).toBe('hello-world'); // Uppercase
    expect(slugify('Hello-World')).toBe('hello-world'); // Already has hyphens
  });

  test('special characters and punctuation', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('Hello@World#2024')).toBe('hello-world-2024');
    expect(slugify('Hello & World')).toBe('hello-world');
    expect(slugify('Hello/World\\Test')).toBe('hello-world\\test');
    expect(slugify('Hello(World)[Test]')).toBe('hello-world-test');
    expect(slugify('Hello"World\'Test')).toBe('hello-world-test');
    expect(slugify('Hello:World;Test')).toBe('hello-world-test');
    expect(slugify('Hello<World>Test')).toBe('hello-world-test');
    expect(slugify('Hello?World=Test')).toBe('hello-world-test');
  });

  test('consecutive hyphen consolidation', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    // Test consecutive hyphens are consolidated
    expect(slugify('Hello---World')).toBe('hello-world');
    expect(slugify('Hello - - - World')).toBe('hello-world');
    expect(slugify('File - Copy')).toBe('file-copy');
    expect(slugify('My (Important) File - Copy [2023]')).toBe('my-important-file-copy-2023');

    // Test leading and trailing hyphens are handled
    expect(slugify('-Hello-World-')).toBe('hello-world');
    expect(slugify('---Hello---World---')).toBe('hello-world');

    // Test with multiple special characters that create consecutive spaces
    expect(slugify('Hello!!!World???Test')).toBe('hello-world-test');
    expect(slugify('File & Test (1)')).toBe('file-test-1');
  });

  test('consecutive hyphen consolidation with custom replacement', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '_',
      },
    });

    // Test consecutive underscores are consolidated
    expect(slugify('Hello___World')).toBe('hello_world');
    expect(slugify('Hello   World')).toBe('hello_world'); // Multiple spaces become single underscore
    expect(slugify('File & Copy')).toBe('file_copy'); // Special chars become underscores
  });

  test('unicode characters with unicode encoding', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('こんにちは 世界')).toBe('こんにちは-世界'); // Japanese
    expect(slugify('안녕하세요 세계')).toBe('안녕하세요-세계'); // Korean
    expect(slugify('Привет мир')).toBe('привет-мир'); // Russian
    expect(slugify('你好 世界')).toBe('你好-世界'); // Chinese
    expect(slugify('Hello 🌍 World')).toBe('hello-🌍-world'); // Emoji
  });

  test('ascii encoding', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        encoding: 'ascii',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('Hello-World_123')).toBe('hello-world_123'); // Underscores and numbers preserved
    expect(slugify('Hello~World')).toBe('hello~world'); // Tilde preserved
    expect(slugify('こんにちは 世界', { fallback: false })).toBe(''); // Non-ASCII removed, no fallback
    expect(slugify('Café')).toBe('caf'); // Non-ASCII characters removed
    expect(slugify('résumé')).toBe('r-sum'); // Accented characters replaced with spaces, trimmed
  });

  test('accent cleaning', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: true,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('Café')).toBe('cafe');
    expect(slugify('résumé')).toBe('resume');
    expect(slugify('naïve')).toBe('naive');
    expect(slugify('Zürich')).toBe('zuerich');
    expect(slugify('São Paulo')).toBe('sao-paulo');
    expect(slugify('François')).toBe('francois');
    expect(slugify('Björk')).toBe('bjoerk');
    expect(slugify('Москва')).toBe('moskva'); // Russian transliteration
  });

  test('custom sanitize replacement', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '_',
      },
    });

    expect(slugify('Hello World')).toBe('hello_world');
    expect(slugify('Hello   World  Test')).toBe('hello_world_test');

    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '',
      },
    });

    expect(slugify('Hello World')).toBe('helloworld');
    expect(slugify('Hello   World  Test')).toBe('helloworldtest');
  });

  test('empty and whitespace strings', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('', { fallback: false })).toBe('');
    expect(slugify('   ', { fallback: false })).toBe('');
    expect(slugify('\t\n\r', { fallback: false })).toBe('');
  });

  test('no site config', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable(null);

    // Should use default values
    expect(slugify('Hello World')).toBe('hello-world');
    expect(slugify('Café')).toBe('café'); // No accent cleaning by default
  });

  test('partial site config', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        clean_accents: true,
        // encoding and sanitize_replacement should use defaults
      },
    });

    expect(slugify('Hello World')).toBe('hello-world'); // Default replacement
    expect(slugify('Café')).toBe('cafe'); // Accent cleaning enabled
    expect(slugify('こんにちは')).toBe('こんにちは'); // Default unicode encoding
  });

  test('edge cases', async () => {
    // @ts-ignore
    (await import('$lib/services/config')).cmsConfig = writable({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('---', { fallback: false })).toBe(''); // All hyphens get consolidated and trimmed, resulting in empty string
    expect(slugify('123')).toBe('123'); // Numbers only
    expect(slugify('a')).toBe('a'); // Single character
    expect(slugify('A')).toBe('a'); // Single uppercase character
    expect(slugify('Hello-World-')).toBe('hello-world'); // Trailing hyphen trimmed
    expect(slugify('-Hello-World')).toBe('hello-world'); // Leading hyphen trimmed
  });
  test('fallback parameter behavior', async () => {
    // @ts-ignore
    const cmsConfigMock = (await import('$lib/services/config')).cmsConfig;

    const originalConfig = {
      backend: { name: 'github' },
      media_folder: 'static/images/uploads',
      collections: [],
      _siteURL: '',
      _baseURL: '',
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    };

    // @ts-ignore
    cmsConfigMock.set(originalConfig);

    // Test with fallback=true (default behavior)
    expect(slugify('', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Should return UUID
    expect(slugify('   ', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Whitespace only should return UUID
    expect(slugify('!!!', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Special chars only should return UUID

    // Test with fallback=false
    expect(slugify('', { fallback: false })).toBe(''); // Should return empty string
    expect(slugify('   ', { fallback: false })).toBe(''); // Whitespace only should return empty string
    expect(slugify('!!!', { fallback: false })).toBe(''); // Special chars only should return empty string

    // Test default parameter (should behave like fallback=true)
    expect(slugify('')).toMatch(/[0-9a-f]{12}/); // Default should return UUID
    expect(slugify('   ')).toMatch(/[0-9a-f]{12}/); // Default should return UUID

    // Test with valid content - fallback parameter should not affect result
    expect(slugify('Hello World', { fallback: true })).toBe('hello-world');
    expect(slugify('Hello World', { fallback: false })).toBe('hello-world');
    expect(slugify('Hello World')).toBe('hello-world'); // Default parameter
  });

  test('fallback with different encodings', async () => {
    // @ts-ignore
    const cmsConfigMock = (await import('$lib/services/config')).cmsConfig;

    // Test fallback with ASCII encoding
    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'ascii',
        clean_accents: false,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('こんにちは', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Non-ASCII with fallback=true
    expect(slugify('こんにちは', { fallback: false })).toBe(''); // Non-ASCII with fallback=false

    // Test fallback with accent cleaning
    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: true,
        sanitize_replacement: '-',
      },
    });

    expect(slugify('éà', { fallback: true })).toBe('ea'); // Valid content after cleaning
    expect(slugify('', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Empty with fallback=true
    expect(slugify('', { fallback: false })).toBe(''); // Empty with fallback=false
  });

  test('fallback with custom sanitize replacement', async () => {
    // @ts-ignore
    const cmsConfigMock = (await import('$lib/services/config')).cmsConfig;

    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '_',
      },
    });

    expect(slugify('Hello World', { fallback: true })).toBe('hello_world');
    expect(slugify('Hello World', { fallback: false })).toBe('hello_world');
    expect(slugify('   ', { fallback: true })).toMatch(/[0-9a-f]{12}/); // Fallback should still work
    expect(slugify('   ', { fallback: false })).toBe(''); // No fallback
  });

  test('trim replacement characters option', async () => {
    // @ts-ignore
    const cmsConfigMock = (await import('$lib/services/config')).cmsConfig;

    // Test with trim enabled (default behavior)
    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
        trim: true,
      },
    });

    expect(slugify('-Hello World-')).toBe('hello-world'); // Leading and trailing hyphens trimmed
    expect(slugify('---Hello---World---')).toBe('hello-world'); // Multiple consecutive hyphens trimmed
    expect(slugify('-', { fallback: false })).toBe(''); // Only replacement characters, should be empty after trim
    expect(slugify('---', { fallback: false })).toBe(''); // Multiple replacement characters only
    expect(slugify('Hello-')).toBe('hello'); // Trailing hyphen trimmed
    expect(slugify('-World')).toBe('world'); // Leading hyphen trimmed

    // Test with trim disabled
    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
        trim: false,
      },
    });

    expect(slugify('-Hello World-')).toBe('-hello-world-'); // Leading and trailing hyphens preserved
    expect(slugify('---Hello---World---')).toBe('-hello-world-'); // Consecutive hyphens consolidated but not trimmed
    expect(slugify('-', { fallback: false })).toBe('-'); // Single replacement character preserved
    expect(slugify('---', { fallback: false })).toBe('-'); // Multiple replacement characters consolidated but not trimmed
    expect(slugify('Hello-')).toBe('hello-'); // Trailing hyphen preserved
    expect(slugify('-World')).toBe('-world'); // Leading hyphen preserved
  });

  test('trim option with custom replacement characters', async () => {
    // @ts-ignore
    const cmsConfigMock = (await import('$lib/services/config')).cmsConfig;

    // Test with underscore replacement and trim enabled
    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '_',
        trim: true,
      },
    });

    expect(slugify('_Hello World_')).toBe('hello_world'); // Leading and trailing underscores trimmed
    expect(slugify('___Hello___World___')).toBe('hello_world'); // Multiple consecutive underscores trimmed
    expect(slugify('_', { fallback: false })).toBe(''); // Only replacement characters, should be empty after trim
    expect(slugify('Hello_')).toBe('hello'); // Trailing underscore trimmed
    expect(slugify('_World')).toBe('world'); // Leading underscore trimmed

    // Test with underscore replacement and trim disabled
    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '_',
        trim: false,
      },
    });

    expect(slugify('_Hello World_')).toBe('_hello_world_'); // Leading and trailing underscores preserved
    expect(slugify('___Hello___World___')).toBe('_hello_world_'); // Consecutive underscores consolidated but not trimmed
    expect(slugify('_', { fallback: false })).toBe('_'); // Single replacement character preserved
    expect(slugify('Hello_')).toBe('hello_'); // Trailing underscore preserved
    expect(slugify('_World')).toBe('_world'); // Leading underscore preserved
  });

  test('trim option with special replacement characters', async () => {
    // @ts-ignore
    const cmsConfigMock = (await import('$lib/services/config')).cmsConfig;

    // Test with dot replacement character (needs escaping in regex)
    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '.',
        trim: true,
      },
    });

    expect(slugify('.Hello World.')).toBe('hello.world'); // Leading and trailing dots trimmed
    expect(slugify('...Hello...World...')).toBe('hello.world'); // Multiple consecutive dots trimmed
    expect(slugify('.', { fallback: false })).toBe(''); // Only replacement characters, should be empty after trim

    // Test with dot replacement and trim disabled
    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '.',
        trim: false,
      },
    });

    expect(slugify('.Hello World.')).toBe('.hello.world.'); // Leading and trailing dots preserved
    expect(slugify('...Hello...World...')).toBe('.hello.world.'); // Consecutive dots consolidated but not trimmed
  });

  test('trim option with empty replacement character', async () => {
    // @ts-ignore
    const cmsConfigMock = (await import('$lib/services/config')).cmsConfig;

    // When replacement is empty, trim option should have no effect
    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '',
        trim: true,
      },
    });

    expect(slugify('Hello World')).toBe('helloworld'); // No replacement character to trim
    expect(slugify(' Hello World ')).toBe('helloworld'); // Spaces removed, no replacement to trim

    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '',
        trim: false,
      },
    });

    expect(slugify('Hello World')).toBe('helloworld'); // Same result regardless of trim option
    expect(slugify(' Hello World ')).toBe('helloworld'); // Same result regardless of trim option
  });

  test('trim option with fallback behavior', async () => {
    // @ts-ignore
    const cmsConfigMock = (await import('$lib/services/config')).cmsConfig;

    // Test that fallback works correctly with trim enabled
    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
        trim: true,
      },
    });

    // With only replacement chars and trim enabled, result is empty and fallback to UUID
    expect(slugify('-', { fallback: true })).toMatch(/[0-9a-f]{12}/);
    expect(slugify('---', { fallback: true })).toMatch(/[0-9a-f]{12}/);
    expect(slugify('-', { fallback: false })).toBe('');
    expect(slugify('---', { fallback: false })).toBe('');

    // Test with trim disabled - replacement characters should be preserved, no fallback needed
    // @ts-ignore
    cmsConfigMock.set({
      slug: {
        encoding: 'unicode',
        clean_accents: false,
        sanitize_replacement: '-',
        trim: false,
      },
    });

    expect(slugify('-', { fallback: true })).toBe('-'); // No fallback needed since result is not empty
    expect(slugify('---', { fallback: true })).toBe('-'); // Consecutive chars consolidated but not trimmed
    expect(slugify('-', { fallback: false })).toBe('-'); // Same result regardless of fallback
    expect(slugify('---', { fallback: false })).toBe('-'); // Same result regardless of fallback
  });
});
