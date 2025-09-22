import { describe, expect, it } from 'vitest';

import { encodeQuotes, isMultiLinePattern, normalizeProps, replaceQuotes } from './utils.js';

describe('utils', () => {
  describe('isMultiLinePattern', () => {
    it('should return true for patterns with multiline flag', () => {
      const pattern = /test/m;
      const result = isMultiLinePattern(pattern);

      expect(result).toBe(true);
    });

    it('should return true for patterns with dotAll flag', () => {
      const pattern = /test/s;
      const result = isMultiLinePattern(pattern);

      expect(result).toBe(true);
    });

    it('should return true for patterns containing [\\s\\S]', () => {
      const pattern = /test[\s\S]*?end/;
      const result = isMultiLinePattern(pattern);

      expect(result).toBe(true);
    });

    it('should return true for patterns containing [\\S\\s]', () => {
      const pattern = /test[\S\s]*?end/;
      const result = isMultiLinePattern(pattern);

      expect(result).toBe(true);
    });

    it('should return false for simple patterns', () => {
      const pattern = /test/;
      const result = isMultiLinePattern(pattern);

      expect(result).toBe(false);
    });

    it('should return false for patterns with only global flag', () => {
      const pattern = /test/g;
      const result = isMultiLinePattern(pattern);

      expect(result).toBe(false);
    });

    it('should return false for patterns with only case insensitive flag', () => {
      const pattern = /test/i;
      const result = isMultiLinePattern(pattern);

      expect(result).toBe(false);
    });

    it('should handle complex patterns with multiple flags', () => {
      const pattern = /test[\s\S]*?end/gim;
      const result = isMultiLinePattern(pattern);

      expect(result).toBe(true);
    });

    it('should handle patterns with dotAll and multiline flags', () => {
      const pattern = /test.*?end/ms;
      const result = isMultiLinePattern(pattern);

      expect(result).toBe(true);
    });
  });

  describe('normalizeProps', () => {
    it('should remove properties starting with __sc_', () => {
      const props = {
        title: 'Test Title',
        content: 'Test Content',
        __sc_internal: 'internal value',
        __sc_another: 'another internal',
        normalProp: 'normal value',
      };

      const result = normalizeProps(props);

      expect(result).toEqual({
        title: 'Test Title',
        content: 'Test Content',
        normalProp: 'normal value',
      });
      expect(result.__sc_internal).toBeUndefined();
      expect(result.__sc_another).toBeUndefined();
    });

    it('should handle nested properties with __sc_ prefixes', () => {
      const props = {
        nested: {
          title: 'Nested Title',
          __sc_internal: 'internal nested',
          deep: {
            value: 'deep value',
            __sc_deep: 'deep internal',
          },
        },
        __sc_root: 'root internal',
      };

      const result = normalizeProps(props);

      expect(result.nested.title).toBe('Nested Title');
      expect(result.nested.deep.value).toBe('deep value');
      expect(result.nested.__sc_internal).toBeUndefined();
      expect(result.nested.deep.__sc_deep).toBeUndefined();
      expect(result.__sc_root).toBeUndefined();
    });

    it('should handle empty objects', () => {
      const props = {};
      const result = normalizeProps(props);

      expect(result).toEqual({});
    });

    it('should handle objects with only internal properties', () => {
      const props = {
        __sc_internal1: 'value1',
        __sc_internal2: 'value2',
      };

      const result = normalizeProps(props);

      expect(result).toEqual({});
    });

    it('should handle arrays in properties', () => {
      const props = {
        items: [
          { name: 'item1', __sc_id: 'internal1' },
          { name: 'item2', __sc_id: 'internal2' },
        ],
        __sc_meta: 'meta data',
      };

      const result = normalizeProps(props);

      expect(result.items).toBeDefined();
      expect(result.items[0].name).toBe('item1');
      expect(result.items[1].name).toBe('item2');
      expect(result.items[0].__sc_id).toBeUndefined();
      expect(result.items[1].__sc_id).toBeUndefined();
      expect(result.__sc_meta).toBeUndefined();
    });

    it('should preserve null and undefined values', () => {
      const props = {
        nullValue: null,
        undefinedValue: undefined,
        __sc_internal: 'remove me',
      };

      const result = normalizeProps(props);

      expect(result.nullValue).toBeNull();
      expect(result.undefinedValue).toBeUndefined();
      expect(result.__sc_internal).toBeUndefined();
    });
  });

  describe('replaceQuotes', () => {
    it('should replace double quotes with single quotes', () => {
      const input = 'Hello "world" and "everyone"';
      const result = replaceQuotes(input);

      expect(result).toBe("Hello 'world' and 'everyone'");
    });

    it('should handle strings without quotes', () => {
      const input = 'Hello world';
      const result = replaceQuotes(input);

      expect(result).toBe('Hello world');
    });

    it('should handle strings with only single quotes', () => {
      const input = "Hello 'world'";
      const result = replaceQuotes(input);

      expect(result).toBe("Hello 'world'");
    });

    it('should handle empty strings', () => {
      const input = '';
      const result = replaceQuotes(input);

      expect(result).toBe('');
    });

    it('should handle strings with mixed quotes', () => {
      const input = 'Hello "world" and \'everyone\'';
      const result = replaceQuotes(input);

      expect(result).toBe("Hello 'world' and 'everyone'");
    });

    it('should handle multiple consecutive double quotes', () => {
      const input = 'Test ""double"" quotes';
      const result = replaceQuotes(input);

      expect(result).toBe("Test ''double'' quotes");
    });

    it('should handle strings that are just quotes', () => {
      const input = '"""';
      const result = replaceQuotes(input);

      expect(result).toBe("'''");
    });
  });

  describe('encodeQuotes', () => {
    it('should encode double quotes as HTML entities', () => {
      const input = 'Hello "world" and "everyone"';
      const result = encodeQuotes(input);

      expect(result).toBe('Hello &quot;world&quot; and &quot;everyone&quot;');
    });

    it('should handle strings without quotes', () => {
      const input = 'Hello world';
      const result = encodeQuotes(input);

      expect(result).toBe('Hello world');
    });

    it('should handle strings with only single quotes', () => {
      const input = "Hello 'world'";
      const result = encodeQuotes(input);

      expect(result).toBe("Hello 'world'");
    });

    it('should handle empty strings', () => {
      const input = '';
      const result = encodeQuotes(input);

      expect(result).toBe('');
    });

    it('should handle strings with mixed quotes', () => {
      const input = 'Hello "world" and \'everyone\'';
      const result = encodeQuotes(input);

      expect(result).toBe("Hello &quot;world&quot; and 'everyone'");
    });

    it('should handle multiple consecutive double quotes', () => {
      const input = 'Test ""double"" quotes';
      const result = encodeQuotes(input);

      expect(result).toBe('Test &quot;&quot;double&quot;&quot; quotes');
    });

    it('should handle strings that are just quotes', () => {
      const input = '"""';
      const result = encodeQuotes(input);

      expect(result).toBe('&quot;&quot;&quot;');
    });

    it('should not affect already encoded entities', () => {
      const input = 'Hello &quot;world&quot; and "everyone"';
      const result = encodeQuotes(input);

      expect(result).toBe('Hello &quot;world&quot; and &quot;everyone&quot;');
    });
  });
});
