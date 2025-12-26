import { describe, expect, it } from 'vitest';

import { isFormatMismatch } from './format';

describe('isFormatMismatch', () => {
  describe('undefined values', () => {
    it('should return false when extension is undefined', () => {
      expect(isFormatMismatch(undefined, 'yaml')).toBe(false);
    });

    it('should return false when format is undefined', () => {
      expect(isFormatMismatch('md', undefined)).toBe(false);
    });

    it('should return false when both are undefined', () => {
      expect(isFormatMismatch(undefined, undefined)).toBe(false);
    });
  });

  describe('known format matching', () => {
    it('should return false when json extension matches json format', () => {
      expect(isFormatMismatch('json', 'json')).toBe(false);
    });

    it('should return false when yaml extension matches yaml format', () => {
      expect(isFormatMismatch('yaml', 'yaml')).toBe(false);
    });

    it('should return false when toml extension matches toml format', () => {
      expect(isFormatMismatch('toml', 'toml')).toBe(false);
    });

    it('should return true when json extension mismatches with yaml format', () => {
      expect(isFormatMismatch('json', 'yaml')).toBe(true);
    });

    it('should return true when yaml extension mismatches with json format', () => {
      expect(isFormatMismatch('yaml', 'json')).toBe(true);
    });

    it('should return true when toml extension mismatches with yaml format', () => {
      expect(isFormatMismatch('toml', 'yaml')).toBe(true);
    });
  });

  describe('yml/yaml normalization', () => {
    it('should treat yml extension as yaml', () => {
      expect(isFormatMismatch('yml', 'yaml')).toBe(false);
    });

    it('should treat yml format as yaml', () => {
      expect(isFormatMismatch('yaml', 'yml')).toBe(false);
    });

    it('should treat yml extension and format as equivalent', () => {
      expect(isFormatMismatch('yml', 'yml')).toBe(false);
    });

    it('should return true when yml extension mismatches with json format', () => {
      expect(isFormatMismatch('yml', 'json')).toBe(true);
    });
  });

  describe('markdown extensions', () => {
    it('should return true when md extension with yaml format', () => {
      // md should only work with frontmatter formats or -frontmatter
      expect(isFormatMismatch('md', 'yaml')).toBe(true);
    });

    it('should return true when md extension with json format', () => {
      // md should only work with frontmatter formats or -frontmatter
      expect(isFormatMismatch('md', 'json')).toBe(true);
    });

    it('should return true when md extension with toml format', () => {
      // md should only work with frontmatter formats or -frontmatter
      expect(isFormatMismatch('md', 'toml')).toBe(true);
    });

    it('should return false when md extension with frontmatter (auto-detect) format', () => {
      // md + frontmatter is valid; frontmatter is the auto-detect format
      expect(isFormatMismatch('md', 'frontmatter')).toBe(false);
    });

    it('should return true when markdown extension with yaml format', () => {
      // markdown should only work with frontmatter formats or -frontmatter
      expect(isFormatMismatch('markdown', 'yaml')).toBe(true);
    });

    it('should return false when markdown extension with frontmatter (auto-detect) format', () => {
      // markdown + frontmatter is valid; frontmatter is the auto-detect format
      expect(isFormatMismatch('markdown', 'frontmatter')).toBe(false);
    });

    it('should return false when md extension with yaml-frontmatter', () => {
      expect(isFormatMismatch('md', 'yaml-frontmatter')).toBe(false);
    });

    it('should return false when markdown extension with toml-frontmatter', () => {
      expect(isFormatMismatch('markdown', 'toml-frontmatter')).toBe(false);
    });

    it('should return false when md extension with json-frontmatter', () => {
      expect(isFormatMismatch('md', 'json-frontmatter')).toBe(false);
    });
  });

  describe('mdx extensions', () => {
    it('should return true when mdx extension with yaml format', () => {
      // mdx should only work with frontmatter formats or -frontmatter
      expect(isFormatMismatch('mdx', 'yaml')).toBe(true);
    });

    it('should return true when mdx extension with json format', () => {
      // mdx should only work with frontmatter formats or -frontmatter
      expect(isFormatMismatch('mdx', 'json')).toBe(true);
    });

    it('should return true when mdx extension with toml format', () => {
      // mdx should only work with frontmatter formats or -frontmatter
      expect(isFormatMismatch('mdx', 'toml')).toBe(true);
    });

    it('should return false when mdx extension with frontmatter (auto-detect) format', () => {
      // mdx + frontmatter is valid; frontmatter is the auto-detect format
      expect(isFormatMismatch('mdx', 'frontmatter')).toBe(false);
    });

    it('should return false when mdx extension with yaml-frontmatter', () => {
      expect(isFormatMismatch('mdx', 'yaml-frontmatter')).toBe(false);
    });

    it('should return false when mdx extension with toml-frontmatter', () => {
      expect(isFormatMismatch('mdx', 'toml-frontmatter')).toBe(false);
    });

    it('should return false when mdx extension with json-frontmatter', () => {
      expect(isFormatMismatch('mdx', 'json-frontmatter')).toBe(false);
    });
  });

  describe('front-matter formats', () => {
    it('should return false when md extension with yaml-frontmatter', () => {
      expect(isFormatMismatch('md', 'yaml-frontmatter')).toBe(false);
    });

    it('should return false when markdown extension with yaml-frontmatter', () => {
      expect(isFormatMismatch('markdown', 'yaml-frontmatter')).toBe(false);
    });

    it('should return false when md extension with toml-frontmatter', () => {
      expect(isFormatMismatch('md', 'toml-frontmatter')).toBe(false);
    });

    it('should return false when md extension with json-frontmatter', () => {
      expect(isFormatMismatch('md', 'json-frontmatter')).toBe(false);
    });

    it('should return false when yaml extension with yaml-frontmatter', () => {
      // yaml extension matches the base type of yaml-frontmatter
      expect(isFormatMismatch('yaml', 'yaml-frontmatter')).toBe(false);
    });

    it('should return false when json extension with json-frontmatter', () => {
      // json extension matches the base type of json-frontmatter
      expect(isFormatMismatch('json', 'json-frontmatter')).toBe(false);
    });

    it('should return false when toml extension with toml-frontmatter', () => {
      // toml extension matches the base type of toml-frontmatter
      expect(isFormatMismatch('toml', 'toml-frontmatter')).toBe(false);
    });

    it('should return true when toml extension with yaml-frontmatter mismatch', () => {
      expect(isFormatMismatch('toml', 'yaml-frontmatter')).toBe(true);
    });
  });

  describe('custom extensions', () => {
    it('should return false when custom extension with known format', () => {
      expect(isFormatMismatch('custom', 'yaml')).toBe(false);
    });

    it('should return false when custom extension with json format', () => {
      expect(isFormatMismatch('myformat', 'json')).toBe(false);
    });

    it('should return false when custom extension with toml format', () => {
      expect(isFormatMismatch('data', 'toml')).toBe(false);
    });

    it('should return false when custom extension with unknown format', () => {
      // 'frontmatter-custom' is not a valid FileFormat, so we skip this
      expect(isFormatMismatch('custom', 'json')).toBe(false);
    });

    it('should return false when html extension with custom format', () => {
      expect(isFormatMismatch('html', 'yaml')).toBe(false);
    });
  });

  describe('invalid combinations', () => {
    it('should return true when json extension with toml format', () => {
      expect(isFormatMismatch('json', 'toml')).toBe(true);
    });

    it('should return true when yaml extension with toml format', () => {
      expect(isFormatMismatch('yaml', 'toml')).toBe(true);
    });

    it('should return true when toml extension with json format', () => {
      expect(isFormatMismatch('toml', 'json')).toBe(true);
    });

    it('should return true when yml extension with toml format', () => {
      expect(isFormatMismatch('yml', 'toml')).toBe(true);
    });

    it('should return true when json extension with toml-frontmatter', () => {
      expect(isFormatMismatch('json', 'toml-frontmatter')).toBe(true);
    });

    it('should return true when yaml extension with json-frontmatter', () => {
      expect(isFormatMismatch('yaml', 'json-frontmatter')).toBe(true);
    });

    it('should return true when toml extension with yaml-frontmatter', () => {
      expect(isFormatMismatch('toml', 'yaml-frontmatter')).toBe(true);
    });

    it('should return true when json extension with yaml-frontmatter', () => {
      expect(isFormatMismatch('json', 'yaml-frontmatter')).toBe(true);
    });

    it('should return false when html extension with json format (custom extension)', () => {
      // html is not a known format, so it's treated as custom extension
      expect(isFormatMismatch('html', 'json')).toBe(false);
    });

    it('should return false when html extension with yaml format (custom extension)', () => {
      // html is not a known format, so it's treated as custom extension
      expect(isFormatMismatch('html', 'yaml')).toBe(false);
    });

    it('should return false when html extension with toml format (custom extension)', () => {
      // html is not a known format, so it's treated as custom extension
      expect(isFormatMismatch('html', 'toml')).toBe(false);
    });

    it('should return true when html extension with yaml-frontmatter', () => {
      // html doesn't match yaml-frontmatter base type and isn't md/markdown
      expect(isFormatMismatch('html', 'yaml-frontmatter')).toBe(true);
    });

    it('should return true when yml extension with json-frontmatter', () => {
      expect(isFormatMismatch('yml', 'json-frontmatter')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle case sensitivity in extensions', () => {
      // Extensions are case-sensitive, so 'JSON' !== 'json'
      expect(isFormatMismatch('JSON', 'json')).toBe(false);
    });

    it('should return true when known extension mismatches any known format', () => {
      // yaml extension cannot be used with toml format
      expect(isFormatMismatch('yaml', 'toml')).toBe(true);
    });

    it('should reject custom frontmatter with wrong extension', () => {
      // Only matching extensions work with frontmatter
      expect(isFormatMismatch('json', 'toml-frontmatter')).toBe(true);
    });

    it('should allow generic frontmatter format with md extension', () => {
      // Generic 'frontmatter' (auto-detect) is valid with md
      expect(isFormatMismatch('md', 'frontmatter')).toBe(false);
    });

    it('should allow generic frontmatter format with markdown extension', () => {
      // Generic 'frontmatter' (auto-detect) is valid with markdown
      expect(isFormatMismatch('markdown', 'frontmatter')).toBe(false);
    });

    it('should reject yml with any non-yaml frontmatter', () => {
      // yml (normalized to yaml) should only work with yaml-frontmatter
      expect(isFormatMismatch('yml', 'toml-frontmatter')).toBe(true);
    });
  });

  describe('frontmatter auto-detect format', () => {
    it('should return false when md extension with frontmatter', () => {
      expect(isFormatMismatch('md', 'frontmatter')).toBe(false);
    });

    it('should return false when markdown extension with frontmatter', () => {
      expect(isFormatMismatch('markdown', 'frontmatter')).toBe(false);
    });

    it('should return false when mdx extension with frontmatter', () => {
      expect(isFormatMismatch('mdx', 'frontmatter')).toBe(false);
    });

    it('should return true when yaml extension with frontmatter', () => {
      // frontmatter is only valid with markdown extensions
      expect(isFormatMismatch('yaml', 'frontmatter')).toBe(true);
    });

    it('should return true when json extension with frontmatter', () => {
      // frontmatter is only valid with markdown extensions
      expect(isFormatMismatch('json', 'frontmatter')).toBe(true);
    });

    it('should return true when toml extension with frontmatter', () => {
      // frontmatter is only valid with markdown extensions
      expect(isFormatMismatch('toml', 'frontmatter')).toBe(true);
    });

    it('should return true when yml extension with frontmatter', () => {
      // frontmatter is only valid with markdown extensions
      expect(isFormatMismatch('yml', 'frontmatter')).toBe(true);
    });

    it('should return true when custom extension with frontmatter', () => {
      // frontmatter is only valid with markdown extensions
      expect(isFormatMismatch('html', 'frontmatter')).toBe(true);
    });
  });

  describe('special case: single body field with front-matter format', () => {
    it('should return false when body code field with yaml-frontmatter format', () => {
      const fields = [{ name: 'body', widget: 'code' }];

      expect(isFormatMismatch('json', 'yaml-frontmatter', fields)).toBe(false);
    });

    it('should return false when body markdown field with toml-frontmatter format', () => {
      const fields = [{ name: 'body', widget: 'markdown' }];

      expect(isFormatMismatch('yaml', 'toml-frontmatter', fields)).toBe(false);
    });

    it('should return false when body richtext field with json-frontmatter format', () => {
      const fields = [{ name: 'body', widget: 'richtext' }];

      expect(isFormatMismatch('toml', 'json-frontmatter', fields)).toBe(false);
    });

    it('should return false when body code field with frontmatter auto-detect format', () => {
      const fields = [{ name: 'body', widget: 'code' }];

      expect(isFormatMismatch('json', 'frontmatter', fields)).toBe(false);
    });

    it('should return true when body code field with non-frontmatter format', () => {
      const fields = [{ name: 'body', widget: 'code' }];

      // Special case only applies to front-matter formats
      expect(isFormatMismatch('json', 'yaml', fields)).toBe(true);
    });

    it('should return true when body field with string widget and frontmatter format', () => {
      const fields = [{ name: 'body', widget: 'string' }];

      // Widget is 'string', not in bodyFieldType, so normal rules apply
      expect(isFormatMismatch('json', 'yaml-frontmatter', fields)).toBe(true);
    });

    it('should return true when non-body field with code widget and frontmatter format', () => {
      const fields = [{ name: 'content', widget: 'code' }];

      // Not named 'body', so normal rules apply
      expect(isFormatMismatch('json', 'yaml-frontmatter', fields)).toBe(true);
    });

    it('should return true when multiple fields including body code field with frontmatter', () => {
      const fields = [
        { name: 'body', widget: 'code' },
        { name: 'title', widget: 'string' },
      ];

      // More than one field, so normal rules apply
      expect(isFormatMismatch('json', 'yaml-frontmatter', fields)).toBe(true);
    });

    it('should return true when body field with undefined widget and frontmatter format', () => {
      const fields = [{ name: 'body' }];

      // Widget defaults to 'string', not in bodyFieldType, so normal rules apply
      expect(isFormatMismatch('json', 'yaml-frontmatter', fields)).toBe(true);
    });

    it('should return false when markdown extension with body code field and frontmatter', () => {
      const fields = [{ name: 'body', widget: 'code' }];

      // Markdown + frontmatter is always valid, special case also applies
      expect(isFormatMismatch('md', 'frontmatter', fields)).toBe(false);
    });
  });
});
