import { afterEach, describe, expect, it, vi } from 'vitest';

import { customFileFormatRegistry } from '$lib/services/api/registries';
import { addMessage } from '$lib/services/config/parser/utils/validator';

import { checkBodyField, isFormatMismatch } from './format';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

vi.mock('$lib/services/config/parser/utils/validator', () => ({ addMessage: vi.fn() }));

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

    it('should return false when html.md extension with yaml-frontmatter', () => {
      expect(isFormatMismatch('html.md', 'yaml-frontmatter')).toBe(false);
    });

    it('should return false when mkd extension with yaml-frontmatter', () => {
      expect(isFormatMismatch('mkd', 'yaml-frontmatter')).toBe(false);
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

    it('should return false when njk extension with yaml-frontmatter', () => {
      // Template engines support any front-matter format
      expect(isFormatMismatch('njk', 'yaml-frontmatter')).toBe(false);
    });

    it('should return false when njk extension with toml-frontmatter', () => {
      // Template engines support any front-matter format
      expect(isFormatMismatch('njk', 'toml-frontmatter')).toBe(false);
    });

    it('should return false when njk extension with json-frontmatter', () => {
      // Template engines support any front-matter format
      expect(isFormatMismatch('njk', 'json-frontmatter')).toBe(false);
    });

    it('should return true when astro extension with yaml-frontmatter', () => {
      // Astro is treated as a raw file format, not a front-matter-compatible template engine
      expect(isFormatMismatch('astro', 'yaml-frontmatter')).toBe(true);
    });

    it('should return true when astro extension with toml-frontmatter', () => {
      // Astro is treated as a raw file format, not a front-matter-compatible template engine
      expect(isFormatMismatch('astro', 'toml-frontmatter')).toBe(true);
    });

    it('should return true when astro extension with json-frontmatter', () => {
      // Astro is treated as a raw file format, not a front-matter-compatible template engine
      expect(isFormatMismatch('astro', 'json-frontmatter')).toBe(true);
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

    it('should return false when html extension with any front-matter format', () => {
      // Like Decap CMS, a non-data extension works with every front-matter format
      expect(isFormatMismatch('html', 'yaml-frontmatter')).toBe(false);
      expect(isFormatMismatch('html', 'toml-frontmatter')).toBe(false);
      expect(isFormatMismatch('html', 'json-frontmatter')).toBe(false);
      expect(isFormatMismatch('html', 'frontmatter')).toBe(false);
      expect(isFormatMismatch('liquid', 'yaml-frontmatter')).toBe(false);
      expect(isFormatMismatch('txt', 'frontmatter')).toBe(false);
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

    it('should return false when njk extension with frontmatter', () => {
      // frontmatter is valid with template engine extensions like njk
      expect(isFormatMismatch('njk', 'frontmatter')).toBe(false);
    });

    it('should return true when astro extension with frontmatter', () => {
      // Astro is treated as a raw file format, not a front-matter-compatible template engine
      expect(isFormatMismatch('astro', 'frontmatter')).toBe(true);
    });
  });

  describe('raw format', () => {
    it('should return false for raw format with any extension and fields', () => {
      const fields = [{ name: 'body', widget: 'code' }];

      expect(isFormatMismatch('json', 'raw', fields)).toBe(false);
    });

    it('should return false for raw format regardless of field configuration', () => {
      const fields = [{ name: 'title', widget: 'string' }];

      expect(isFormatMismatch('txt', 'raw', fields)).toBe(false);
    });

    it('should return false for raw format with no fields', () => {
      expect(isFormatMismatch('html', 'raw', [])).toBe(false);
    });
  });

  describe('custom format', () => {
    afterEach(() => {
      customFileFormatRegistry.clear();
    });

    it('should return false for a custom format with any extension, including `md`', () => {
      // The example in the documentation
      customFileFormatRegistry.set('custom-markdown', { extension: 'md' });

      // A Markdown extension only took a front matter format
      expect(isFormatMismatch('md', 'custom-markdown')).toBe(false);
      expect(isFormatMismatch('markdown', 'custom-markdown')).toBe(false);
      expect(isFormatMismatch('json', 'custom-markdown')).toBe(false);
      // An unregistered format is still checked
      expect(isFormatMismatch('md', 'other-markdown')).toBe(true);
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

    it('should return false when body text field with yaml-frontmatter format', () => {
      const fields = [{ name: 'body', widget: 'text' }];

      expect(isFormatMismatch('json', 'yaml-frontmatter', fields)).toBe(false);
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

    it('should return false when body field with string widget and raw format', () => {
      const fields = [{ name: 'body', widget: 'string' }];

      // raw format never triggers mismatch regardless of field configuration
      expect(isFormatMismatch('json', 'raw', fields)).toBe(false);
    });

    it('should return true when body field with string widget and frontmatter format', () => {
      const fields = [{ name: 'body', widget: 'string' }];

      // Widget is 'string', not in bodyFieldType, so normal rules apply
      expect(isFormatMismatch('json', 'yaml-frontmatter', fields)).toBe(true);
    });

    it('should return false when non-body field with code widget and raw format', () => {
      const fields = [{ name: 'content', widget: 'code' }];

      // raw format never triggers mismatch regardless of field configuration
      expect(isFormatMismatch('json', 'raw', fields)).toBe(false);
    });

    it('should return true when non-body field with code widget and frontmatter format', () => {
      const fields = [{ name: 'content', widget: 'code' }];

      // Not named 'body', so normal rules apply
      expect(isFormatMismatch('json', 'yaml-frontmatter', fields)).toBe(true);
    });

    it('should return false when multiple fields including body code field with raw format', () => {
      const fields = [
        { name: 'body', widget: 'code' },
        { name: 'title', widget: 'string' },
      ];

      // raw format never triggers mismatch regardless of field configuration
      expect(isFormatMismatch('json', 'raw', fields)).toBe(false);
    });

    it('should return true when multiple fields including body code field with frontmatter', () => {
      const fields = [
        { name: 'body', widget: 'code' },
        { name: 'title', widget: 'string' },
      ];

      // More than one field, so normal rules apply
      expect(isFormatMismatch('json', 'yaml-frontmatter', fields)).toBe(true);
    });

    it('should return false when body field with undefined widget and raw format', () => {
      const fields = [{ name: 'body' }];

      // raw format never triggers mismatch regardless of field configuration
      expect(isFormatMismatch('json', 'raw', fields)).toBe(false);
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

  describe('unknown format', () => {
    it('should return false for unknown format with any extension (line 83)', () => {
      // Unknown formats don't enforce mismatch
      expect(isFormatMismatch('csv', 'csv')).toBe(false);
      expect(isFormatMismatch('txt', 'custom-format')).toBe(false);
      expect(isFormatMismatch('xml', 'xml-schema')).toBe(false);
    });
  });

  describe('comprehensive markdown extensions with frontmatter formats', () => {
    it('should allow md extension with frontmatter', () => {
      expect(isFormatMismatch('md', 'frontmatter')).toBe(false);
    });

    it('should allow markdown extension with frontmatter', () => {
      expect(isFormatMismatch('markdown', 'frontmatter')).toBe(false);
    });

    it('should allow mdx extension with frontmatter', () => {
      expect(isFormatMismatch('mdx', 'frontmatter')).toBe(false);
    });

    it('should allow md with yaml-frontmatter', () => {
      expect(isFormatMismatch('md', 'yaml-frontmatter')).toBe(false);
    });

    it('should allow md with json-frontmatter', () => {
      expect(isFormatMismatch('md', 'json-frontmatter')).toBe(false);
    });

    it('should allow md with toml-frontmatter', () => {
      expect(isFormatMismatch('md', 'toml-frontmatter')).toBe(false);
    });

    it('should allow markdown with yaml-frontmatter', () => {
      expect(isFormatMismatch('markdown', 'yaml-frontmatter')).toBe(false);
    });

    it('should allow markdown with json-frontmatter', () => {
      expect(isFormatMismatch('markdown', 'json-frontmatter')).toBe(false);
    });

    it('should allow markdown with toml-frontmatter', () => {
      expect(isFormatMismatch('markdown', 'toml-frontmatter')).toBe(false);
    });

    it('should allow mdx with yaml-frontmatter', () => {
      expect(isFormatMismatch('mdx', 'yaml-frontmatter')).toBe(false);
    });

    it('should allow mdx with json-frontmatter', () => {
      expect(isFormatMismatch('mdx', 'json-frontmatter')).toBe(false);
    });

    it('should allow mdx with toml-frontmatter', () => {
      expect(isFormatMismatch('mdx', 'toml-frontmatter')).toBe(false);
    });
  });

  describe('comprehensive template engine extensions with frontmatter formats', () => {
    it('should allow njk with frontmatter', () => {
      expect(isFormatMismatch('njk', 'frontmatter')).toBe(false);
    });

    it('should allow njk with yaml-frontmatter', () => {
      expect(isFormatMismatch('njk', 'yaml-frontmatter')).toBe(false);
    });

    it('should allow njk with json-frontmatter', () => {
      expect(isFormatMismatch('njk', 'json-frontmatter')).toBe(false);
    });

    it('should allow njk with toml-frontmatter', () => {
      expect(isFormatMismatch('njk', 'toml-frontmatter')).toBe(false);
    });

    it('should reject astro with frontmatter', () => {
      expect(isFormatMismatch('astro', 'frontmatter')).toBe(true);
    });

    it('should reject astro with yaml-frontmatter', () => {
      expect(isFormatMismatch('astro', 'yaml-frontmatter')).toBe(true);
    });

    it('should reject astro with json-frontmatter', () => {
      expect(isFormatMismatch('astro', 'json-frontmatter')).toBe(true);
    });

    it('should reject astro with toml-frontmatter', () => {
      expect(isFormatMismatch('astro', 'toml-frontmatter')).toBe(true);
    });
  });
});

describe('checkBodyField', () => {
  /** @type {ConfigParserCollectors} */
  const collectors = {
    errors: new Set(),
    warnings: new Set(),
    mediaFields: new Set(),
    relationFields: new Set(),
  };

  const context = { collection: /** @type {any} */ ({ name: 'posts' }) };

  /**
   * Call {@link checkBodyField} and get the message it added, if any.
   * @param {Record<string, any>} args Arguments other than the context and collectors.
   * @returns {any} Arguments passed to `addMessage()`, or `undefined`.
   */
  const check = (args) => {
    vi.mocked(addMessage).mockClear();
    checkBodyField({ ...args, context, collectors });

    return vi.mocked(addMessage).mock.calls[0]?.[0];
  };

  it('should report a `body` field that doesn’t hold text in a front matter format', () => {
    ['object', 'list', 'keyvalue', 'boolean', 'number'].forEach((widget) => {
      expect(check({ fields: [{ name: 'title' }, { name: 'body', widget }] })).toEqual({
        strKey: 'front_matter_body_field_not_text',
        values: { name: 'body', widget },
        context: { ...context, typedKeyPath: 'body' },
        collectors,
      });
    });

    // A field holding a list of values
    expect(
      check({ fields: [{ name: 'body', widget: 'select', options: ['a'], multiple: true }] }),
    ).toMatchObject({ values: { name: 'body', widget: 'select' } });
    // Every front matter format, including one given with a template engine extension
    expect(
      check({
        extension: 'html',
        format: 'toml-frontmatter',
        fields: [{ name: 'body', widget: 'list' }],
      }),
    ).toBeDefined();
    // The field named with the `body_field` option
    expect(
      check({ bodyField: { key: 'content' }, fields: [{ name: 'content', widget: 'object' }] }),
    ).toMatchObject({ values: { name: 'content', widget: 'object' } });
  });

  it('should leave alone a `body` field that holds text or isn’t below the front matter', () => {
    // Fields holding text
    ['string', 'text', 'markdown', 'richtext', 'code', 'select', 'hidden', 'my-custom'].forEach(
      (widget) => {
        expect(check({ fields: [{ name: 'body', widget }] })).toBeUndefined();
      },
    );
    expect(check({ fields: [{ name: 'body' }] })).toBeUndefined();
    expect(
      check({ fields: [{ name: 'body', widget: 'number', value_type: 'int/string' }] }),
    ).toBeUndefined();
    // The body is stored in the front matter along with the other fields
    expect(
      check({ bodyField: { inline: true }, fields: [{ name: 'body', widget: 'object' }] }),
    ).toBeUndefined();
    // Another field is the body
    expect(
      check({ bodyField: { key: 'content' }, fields: [{ name: 'body', widget: 'object' }] }),
    ).toBeUndefined();
    // Not a front matter format
    expect(
      check({ extension: 'yml', fields: [{ name: 'body', widget: 'object' }] }),
    ).toBeUndefined();
    expect(check({ format: 'json', fields: [{ name: 'body', widget: 'object' }] })).toBeUndefined();
    // No fields
    expect(check({})).toBeUndefined();
  });
});
