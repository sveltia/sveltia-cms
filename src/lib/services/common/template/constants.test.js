import { generateUUID } from '@sveltia/utils/crypto';
import { describe, expect, test } from 'vitest';

import { replaceTemplateTags } from '$lib/services/common/template/tags';

import {
  DATE_TIME_FIELDS,
  ESCAPED_PLACEHOLDER_REGEX,
  TEMPLATE_TAG_REGEX,
  TEMPLATE_TAG_REPLACE_REGEX,
  UUID_TYPES,
} from './constants';

describe('Template constants', () => {
  describe('TEMPLATE_TAG_REGEX', () => {
    test('should match simple template tags', () => {
      expect(TEMPLATE_TAG_REGEX.test('{{title}}')).toBe(true);
      expect(TEMPLATE_TAG_REGEX.test('{{slug}}')).toBe(true);
      expect(TEMPLATE_TAG_REGEX.test('{{year}}')).toBe(true);
    });

    test('should match template tags with content', () => {
      expect(TEMPLATE_TAG_REGEX.test('prefix {{title}} suffix')).toBe(true);
    });

    test('should not match incomplete tags', () => {
      expect(TEMPLATE_TAG_REGEX.test('{{title')).toBe(false);
      expect(TEMPLATE_TAG_REGEX.test('title}}')).toBe(false);
    });

    test('should not match an escaped tag', () => {
      expect(TEMPLATE_TAG_REGEX.test('\\{{title}}')).toBe(false);
      expect('\\{{title}}-{{slug}}'.match(TEMPLATE_TAG_REGEX)?.[0]).toBe('{{slug}}');
    });

    test('should match first occurrence only', () => {
      const str = '{{title}}-{{slug}}';
      const match = str.match(TEMPLATE_TAG_REGEX);

      expect(match).not.toBeNull();
      expect(match?.[0]).toBe('{{title}}');
    });
  });

  describe('TEMPLATE_TAG_REPLACE_REGEX', () => {
    test('should have global flag for replacement', () => {
      expect(TEMPLATE_TAG_REPLACE_REGEX.global).toBe(true);
    });

    test('should match template tags globally', () => {
      const str = '{{title}}-{{slug}}-{{year}}';
      const matches = str.match(TEMPLATE_TAG_REPLACE_REGEX);

      expect(matches).toHaveLength(3);
      expect(matches).toEqual(['{{title}}', '{{slug}}', '{{year}}']);
    });

    test('should capture inner content', () => {
      const str = '{{title}}';
      const match = TEMPLATE_TAG_REPLACE_REGEX.exec(str);

      expect(match?.[1]).toBe('title');
    });

    test('should preserve nested placeholders inside transformation arguments', () => {
      const str = "{{fields.subtitle | default('{{fields.title}}')}}";
      const result = replaceTemplateTags(str, (_match, tag) => `<<${tag}>>`);

      expect(result).toEqual("<<fields.subtitle | default('{{fields.title}}')>>");
    });

    test('should preserve nested placeholders inside ternary transformation arguments', () => {
      const str = "{{draft | ternary('{{subtitle}}', '{{title}}')}}";
      const result = replaceTemplateTags(str, (_match, tag) => `<<${tag}>>`);

      expect(result).toEqual("<<draft | ternary('{{subtitle}}', '{{title}}')>>");
    });

    test('should replace a quoted placeholder in literal text that looks like a transformation', () => {
      const str = "default('{{title}}')";
      const result = replaceTemplateTags(str, (_match, tag) => `<<${tag}>>`);

      expect(result).toEqual("default('<<title>>')");
    });

    test('should replace a quoted placeholder in literal text that looks like a function call', () => {
      const str = "foo('{{title}}')";
      const result = replaceTemplateTags(str, (_match, tag) => `<<${tag}>>`);

      expect(result).toEqual("foo('<<title>>')");
    });

    test('should replace quoted placeholders when the surrounding delimiter is not a transformation delimiter', () => {
      const str = "foo('{{title}}'x)";
      const result = replaceTemplateTags(str, (_match, tag) => `<<${tag}>>`);

      expect(result).toEqual("foo('<<title>>'x)");
    });

    test('should replace quoted placeholders outside transformation argument contexts', () => {
      const str = "foo '{{title}}'";
      const result = replaceTemplateTags(str, (_match, tag) => `<<${tag}>>`);

      expect(result).toEqual("foo '<<title>>'");
    });

    test('should leave empty placeholders unchanged', () => {
      const str = '{{}}';
      const result = replaceTemplateTags(str, (_match, tag) => `<<${tag}>>`);

      expect(result).toEqual('{{}}');
    });

    test('should still replace quoted placeholders in summary templates', () => {
      const str = "'{{title}}', '{{locales}}', content/main/{{filename}}.{{extension}}";
      const result = replaceTemplateTags(str, (_match, tag) => `<<${tag}>>`);

      expect(result).toEqual("'<<title>>', '<<locales>>', content/main/<<filename>>.<<extension>>");
    });
  });

  describe('ESCAPED_PLACEHOLDER_REGEX', () => {
    test('should match escaped placeholder patterns', () => {
      expect(ESCAPED_PLACEHOLDER_REGEX.test('\\{\\{escaped\\}\\}')).toBe(true);
    });

    test('should have global flag', () => {
      expect(ESCAPED_PLACEHOLDER_REGEX.global).toBe(true);
    });

    test('should not match unescaped patterns', () => {
      expect(ESCAPED_PLACEHOLDER_REGEX.test('{{unescaped}}')).toBe(false);
    });
  });

  describe('DATE_TIME_FIELDS', () => {
    test('should contain all date-time field names', () => {
      expect(DATE_TIME_FIELDS).toContain('year');
      expect(DATE_TIME_FIELDS).toContain('month');
      expect(DATE_TIME_FIELDS).toContain('day');
      expect(DATE_TIME_FIELDS).toContain('hour');
      expect(DATE_TIME_FIELDS).toContain('minute');
      expect(DATE_TIME_FIELDS).toContain('second');
    });

    test('should have exactly 6 fields', () => {
      expect(DATE_TIME_FIELDS).toHaveLength(6);
    });

    test('should be an array', () => {
      expect(Array.isArray(DATE_TIME_FIELDS)).toBe(true);
    });
  });

  describe('UUID_TYPES', () => {
    test('should have the uuid type', () => {
      expect(UUID_TYPES.uuid).toEqual({ length: undefined, pattern: expect.any(String) });
    });

    test('should have the uuid_short type', () => {
      expect(UUID_TYPES.uuid_short).toEqual({ length: 'short', pattern: '[0-9a-f]{12}' });
    });

    test('should have the uuid_shorter type', () => {
      expect(UUID_TYPES.uuid_shorter).toEqual({ length: 'shorter', pattern: '[0-9a-f]{8}' });
    });

    test('should be a mapping of tag names', () => {
      expect(typeof UUID_TYPES).toBe('object');
      expect(Object.keys(UUID_TYPES)).toHaveLength(3);
    });

    test('should have a pattern matching each generated UUID', () => {
      Object.values(UUID_TYPES).forEach(({ length, pattern }) => {
        expect(generateUUID(length)).toMatch(new RegExp(`^${pattern}$`));
      });
    });
  });
});
