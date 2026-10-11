// @vitest-environment happy-dom
/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, it } from 'vitest';

import {
  escapeTitle,
  getParentComponentNames,
  getSelectorTagNames,
  isMultiLinePattern,
  isValidSelector,
  normalizeProps,
  supportsHTML,
  unescapeTitle,
} from './utils.js';

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
    it('should keep the keys with a dot as they are', () => {
      expect(normalizeProps({ kv: { 'example.com': 'a' }, __sc_component_name: 'x' })).toEqual({
        kv: { 'example.com': 'a' },
      });
    });

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

  describe('unescapeTitle', () => {
    it('should unescape the ASCII punctuation characters', () => {
      expect(unescapeTitle('T \\"q\\" \\\\ \\* \\(x\\)')).toBe('T "q" \\ * (x)');
    });

    it('should keep a backslash before any other character', () => {
      expect(unescapeTitle('C:\\Users\\me é\\é')).toBe('C:\\Users\\me é\\é');
    });

    it('should handle a title without escapes', () => {
      expect(unescapeTitle('')).toBe('');
      expect(unescapeTitle("It's a title")).toBe("It's a title");
    });
  });

  describe('escapeTitle', () => {
    it('should escape double quotes', () => {
      expect(escapeTitle('Hello "world"')).toBe('Hello \\"world\\"');
    });

    it('should escape a backslash before a punctuation character or at the end', () => {
      expect(escapeTitle('a\\" b\\* c\\')).toBe('a\\\\\\" b\\\\* c\\\\');
    });

    it('should keep a backslash before any other character as is', () => {
      expect(escapeTitle('C:\\Users\\me')).toBe('C:\\Users\\me');
    });

    it('should handle a title without quotes or backslashes', () => {
      expect(escapeTitle('')).toBe('');
      expect(escapeTitle("It's a title")).toBe("It's a title");
    });

    it('should be the counterpart of unescapeTitle', () => {
      ['T "q"', 'a\\"b', 'end\\', 'C:\\Users', '\\\\"', '"""'].forEach((title) => {
        expect(unescapeTitle(escapeTitle(title))).toBe(title);
      });
    });
  });
});

describe('getSelectorTagNames', () => {
  it('should get the element type of each selector in a list, without duplicates', () => {
    expect(getSelectorTagNames('a:has(> img:only-child), IMG, img.wide')).toEqual(['a', 'img']);
  });

  it('should get the element type the last compound selector matches', () => {
    expect(getSelectorTagNames('figure > img.wide')).toEqual(['img']);
    expect(getSelectorTagNames('section aside ~ p')).toEqual(['p']);
    expect(getSelectorTagNames(' aside.note ')).toEqual(['aside']);
    expect(getSelectorTagNames('my-element[data-x]')).toEqual(['my-element']);
  });

  it('should ignore commas, spaces and combinators in brackets, parentheses and quotes', () => {
    expect(getSelectorTagNames('div[title="a, b > c"]')).toEqual(['div']);
    expect(getSelectorTagNames("[title='x ~ y'] > span")).toEqual(['span']);
    expect(getSelectorTagNames('a:not(.x, .y) , b')).toEqual(['a', 'b']);
  });

  it('should return undefined if a selector doesn’t name its element type', () => {
    expect(getSelectorTagNames('.note')).toBeUndefined();
    expect(getSelectorTagNames('img, .note')).toBeUndefined();
    expect(getSelectorTagNames(':is(aside, div)')).toBeUndefined();
    expect(getSelectorTagNames('*')).toBeUndefined();
  });
});

describe('isValidSelector', () => {
  it('should tell a valid selector from an invalid one', () => {
    expect(isValidSelector('a:has(> img), img')).toBe(true);
    expect(isValidSelector('a:has(')).toBe(false);
    expect(isValidSelector('')).toBe(false);
  });
});

describe('supportsHTML', () => {
  it('should require htmlSelector, fromBlockHTML and toBlockHTML', () => {
    /** @type {import('$lib/types/public').EditorComponentDefinition} */
    const def = { id: 'b', fields: [], pattern: /b/, toBlock: () => '' };
    const htmlOptions = { htmlSelector: 'b', fromBlockHTML: () => ({}), toBlockHTML: () => '' };

    expect(supportsHTML({ ...def, ...htmlOptions })).toBe(true);
    expect(supportsHTML({ ...def, ...htmlOptions, htmlSelector: undefined })).toBe(false);
    expect(supportsHTML({ ...def, ...htmlOptions, fromBlockHTML: undefined })).toBe(false);
    expect(supportsHTML({ ...def, ...htmlOptions, toBlockHTML: undefined })).toBe(false);
  });
});

describe('getParentComponentNames', () => {
  it('should read the names from the closest component’s fields, but not its own', () => {
    // A YouTube component in a Details component, in a Callout component in a dialog: the dialog is
    // rendered elsewhere, so only the elements holding the fields tell where a component is
    document.body.innerHTML =
      '<div data-component-path=\'["x-callout"]\'>' +
      '<div data-component-path=\'["x-callout","x-details"]\'>' +
      '<p><span id="youtube" data-component-path=\'["x-callout","x-details","x-youtube"]\'>' +
      '</span></p></div></div>' +
      '<span id="top" data-component-path=\'["x-image"]\'></span>';

    expect(getParentComponentNames(document.querySelector('#youtube') ?? undefined)).toEqual([
      'x-callout',
      'x-details',
    ]);
    expect(getParentComponentNames(document.querySelector('#top') ?? undefined)).toEqual([]);
    expect(getParentComponentNames(undefined)).toEqual([]);
  });
});
