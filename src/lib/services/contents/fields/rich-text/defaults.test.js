import { stripTags } from '@sveltia/utils/string';
import { writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getDefaultValueMap } from './defaults';

// Keep a spy handle that individual tests can override
vi.mock('@sveltia/utils/string', async (importOriginal) => {
  const original = /** @type {any} */ (await importOriginal());

  return { ...original, stripTags: vi.fn(original.stripTags) };
});

vi.mock('$lib/services/config');

beforeEach(async () => {
  // @ts-ignore
  (await import('$lib/services/config')).cmsConfig = writable(null);
});

/**
 * @import { RichTextField } from '$lib/types/public';
 */

/** @type {Pick<RichTextField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'richtext',
  name: 'test_richtext',
};

describe('Test getDefaultValueMap()', () => {
  describe('without dynamicValue', () => {
    test('should return default markdown value', () => {
      /** @type {RichTextField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '# Hello World\n\nThis is a **markdown** document.',
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({
        content: '# Hello World\n\nThis is a **markdown** document.',
      });
    });

    test('should return empty string when no default', () => {
      /** @type {RichTextField} */
      const fieldConfig = {
        ...baseFieldConfig,
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ content: '' });
    });

    test('should return empty string when default is null', () => {
      /** @type {RichTextField} */
      const fieldConfig = {
        ...baseFieldConfig,
        // @ts-expect-error - Testing edge case
        default: null,
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ content: '' });
    });

    test('should return empty string when default is undefined', () => {
      /** @type {RichTextField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: undefined,
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ content: '' });
    });

    test('should handle different key paths', () => {
      /** @type {RichTextField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Sample content',
      };

      const keyPath = 'article.body';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ 'article.body': 'Sample content' });
    });
  });

  describe('with dynamicValue', () => {
    test('should prioritize dynamicValue over default', () => {
      /** @type {RichTextField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Default content',
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '# Dynamic Content\n\nThis is dynamic.',
      });

      expect(result).toEqual({
        content: '# Dynamic Content\n\nThis is dynamic.',
      });
    });

    test('should sanitize HTML tags in dynamicValue', () => {
      /** @type {RichTextField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Default content',
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue:
          '<script>alert("xss")</script># Safe Content\n\n<img src="x" onerror="alert(1)">Safe text',
      });

      // The stripTags function should remove HTML tags
      expect(result.content).not.toContain('<script>');
      expect(result.content).not.toContain('<img');
      expect(result.content).toContain('# Safe Content');
      expect(result.content).toContain('Safe text');
    });

    test('should handle empty dynamicValue', () => {
      /** @type {RichTextField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Default content',
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '',
      });

      expect(result).toEqual({ content: '' });
    });

    test('should handle dynamicValue when no default exists', () => {
      /** @type {RichTextField} */
      const fieldConfig = {
        ...baseFieldConfig,
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: 'Dynamic markdown content',
      });

      expect(result).toEqual({ content: 'Dynamic markdown content' });
    });

    test('should preserve markdown formatting in dynamicValue', () => {
      /** @type {RichTextField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Default content',
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '# Title\n\n**Bold** and *italic* text\n\n- List item 1\n- List item 2',
      });

      expect(result).toEqual({
        content: '# Title\n\n**Bold** and *italic* text\n\n- List item 1\n- List item 2',
      });
    });

    test('should use regex fallback when stripTags throws (e.g. no DOMParser)', () => {
      vi.mocked(stripTags).mockImplementationOnce(() => {
        throw new Error('DOMParser not available');
      });

      /** @type {RichTextField} */
      const fieldConfig = { ...baseFieldConfig };

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath: 'content',
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: '<b>Bold</b> text with <em>emphasis</em>',
      });

      // The catch-block regex fallback should strip tags
      expect(result.content).toBe('Bold text with emphasis');
    });

    test('should handle undefined dynamicValue', () => {
      /** @type {RichTextField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Default content',
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: undefined,
      });

      expect(result).toEqual({ content: 'Default content' });
    });
  });

  describe('with field_defaults fallback', () => {
    test('should use field_defaults when field has no default', async () => {
      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = writable({
        field_defaults: { richtext: { default: '# Default from config' } },
      });

      /** @type {RichTextField} */
      const fieldConfig = { ...baseFieldConfig };

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath: 'content',
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ content: '# Default from config' });
    });

    test('should prefer field-level default over field_defaults', async () => {
      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = writable({
        field_defaults: { richtext: { default: '# Default from config' } },
      });

      /** @type {RichTextField} */
      const fieldConfig = { ...baseFieldConfig, default: '# Field default' };

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath: 'content',
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ content: '# Field default' });
    });

    test('should return empty string when field_defaults has no default', async () => {
      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = writable({
        field_defaults: { richtext: {} },
      });

      /** @type {RichTextField} */
      const fieldConfig = { ...baseFieldConfig };

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath: 'content',
        locale: '_default',
        defaultLocale: '_default',
      });

      expect(result).toEqual({ content: '' });
    });

    test('dynamicValue takes precedence over field_defaults', async () => {
      // @ts-ignore
      (await import('$lib/services/config')).cmsConfig = writable({
        field_defaults: { richtext: { default: '# Default from config' } },
      });

      /** @type {RichTextField} */
      const fieldConfig = { ...baseFieldConfig };

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath: 'content',
        locale: '_default',
        defaultLocale: '_default',
        dynamicValue: 'Dynamic content',
      });

      expect(result).toEqual({ content: 'Dynamic content' });
    });
  });
});
