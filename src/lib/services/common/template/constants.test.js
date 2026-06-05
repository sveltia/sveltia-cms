import { describe, expect, test } from 'vitest';

import {
  DATE_TIME_FIELDS,
  ESCAPED_PLACEHOLDER_REGEX,
  INNER_TAG_REGEX,
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

    test('should apply negative lookahead for escaped patterns', () => {
      // The regex has a negative lookahead (?!\'\)) to exclude }}') sequences
      const str = "test')";
      const match = TEMPLATE_TAG_REPLACE_REGEX.exec(str);

      expect(match).toBeNull();
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

  describe('INNER_TAG_REGEX', () => {
    test('should match and capture inner tag content', () => {
      const str = '{{title}}';
      const match = str.match(INNER_TAG_REGEX);

      expect(match?.groups?.innerTag).toBe('title');
    });

    test('should capture complex inner tags', () => {
      const str = '{{fields.title | upper}}';
      const match = str.match(INNER_TAG_REGEX);

      expect(match?.groups?.innerTag).toBe('fields.title | upper');
    });

    test('should not match incomplete tags', () => {
      expect('{{title'.match(INNER_TAG_REGEX)).toBeNull();
      expect('title}}'.match(INNER_TAG_REGEX)).toBeNull();
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
    test('should have uuid type', () => {
      expect(UUID_TYPES.uuid).toBeDefined();
      expect(UUID_TYPES.uuid).toBe('uuid');
    });

    test('should have uuid_short type', () => {
      expect(UUID_TYPES.uuid_short).toBeDefined();
      expect(UUID_TYPES.uuid_short).toBe('uuid_short');
    });

    test('should have uuid_shorter type', () => {
      expect(UUID_TYPES.uuid_shorter).toBeDefined();
      expect(UUID_TYPES.uuid_shorter).toBe('uuid_shorter');
    });

    test('should be a mapping of tag names', () => {
      expect(typeof UUID_TYPES).toBe('object');
      expect(Object.keys(UUID_TYPES)).toHaveLength(3);
    });

    test('should contain only string values', () => {
      Object.values(UUID_TYPES).forEach((value) => {
        expect(typeof value).toBe('string');
      });
    });
  });
});
