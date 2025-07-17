import { describe, expect, test } from 'vitest';
import { getDefaultValueMap } from './defaults';

/**
 * @import { MarkdownField } from '$lib/types/public';
 */

/** @type {Pick<MarkdownField, 'widget' | 'name'>} */
const baseFieldConfig = {
  widget: 'markdown',
  name: 'test_markdown',
};

describe('Test getDefaultValueMap()', () => {
  describe('without dynamicValue', () => {
    test('should return default markdown value', () => {
      /** @type {MarkdownField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: '# Hello World\n\nThis is a **markdown** document.',
      };

      const keyPath = 'content';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({
        content: '# Hello World\n\nThis is a **markdown** document.',
      });
    });

    test('should return empty string when no default', () => {
      /** @type {MarkdownField} */
      const fieldConfig = {
        ...baseFieldConfig,
      };

      const keyPath = 'content';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({ content: '' });
    });

    test('should return empty string when default is null', () => {
      /** @type {MarkdownField} */
      const fieldConfig = {
        ...baseFieldConfig,
        // @ts-expect-error - Testing edge case
        default: null,
      };

      const keyPath = 'content';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({ content: '' });
    });

    test('should return empty string when default is undefined', () => {
      /** @type {MarkdownField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: undefined,
      };

      const keyPath = 'content';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({ content: '' });
    });

    test('should handle different key paths', () => {
      /** @type {MarkdownField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Sample content',
      };

      const keyPath = 'article.body';
      const result = getDefaultValueMap({ fieldConfig, keyPath, locale: '_default' });

      expect(result).toEqual({ 'article.body': 'Sample content' });
    });
  });

  describe('with dynamicValue', () => {
    test('should prioritize dynamicValue over default', () => {
      /** @type {MarkdownField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Default content',
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '# Dynamic Content\n\nThis is dynamic.',
      });

      expect(result).toEqual({
        content: '# Dynamic Content\n\nThis is dynamic.',
      });
    });

    test('should sanitize HTML tags in dynamicValue', () => {
      /** @type {MarkdownField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Default content',
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
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
      /** @type {MarkdownField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Default content',
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '',
      });

      expect(result).toEqual({ content: '' });
    });

    test('should handle dynamicValue when no default exists', () => {
      /** @type {MarkdownField} */
      const fieldConfig = {
        ...baseFieldConfig,
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: 'Dynamic markdown content',
      });

      expect(result).toEqual({ content: 'Dynamic markdown content' });
    });

    test('should preserve markdown formatting in dynamicValue', () => {
      /** @type {MarkdownField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Default content',
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: '# Title\n\n**Bold** and *italic* text\n\n- List item 1\n- List item 2',
      });

      expect(result).toEqual({
        content: '# Title\n\n**Bold** and *italic* text\n\n- List item 1\n- List item 2',
      });
    });

    test('should handle undefined dynamicValue', () => {
      /** @type {MarkdownField} */
      const fieldConfig = {
        ...baseFieldConfig,
        default: 'Default content',
      };

      const keyPath = 'content';

      const result = getDefaultValueMap({
        fieldConfig,
        keyPath,
        locale: '_default',
        dynamicValue: undefined,
      });

      expect(result).toEqual({ content: 'Default content' });
    });
  });
});
