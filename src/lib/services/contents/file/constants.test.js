import { describe, expect, test } from 'vitest';

import { getFormatSyntax } from '$lib/services/contents/file/constants';

describe('getFormatSyntax', () => {
  test('returns the syntax of a whole-file format', () => {
    expect(getFormatSyntax('yml')).toBe('yaml');
    expect(getFormatSyntax('yaml')).toBe('yaml');
    expect(getFormatSyntax('toml')).toBe('toml');
    expect(getFormatSyntax('json')).toBe('json');
  });

  test('returns the syntax of the front matter of a front matter format', () => {
    expect(getFormatSyntax('frontmatter')).toBe('yaml');
    expect(getFormatSyntax('yaml-frontmatter')).toBe('yaml');
    expect(getFormatSyntax('toml-frontmatter')).toBe('toml');
    expect(getFormatSyntax('json-frontmatter')).toBe('json');
  });

  test('returns nothing for the raw format and any other format', () => {
    expect(getFormatSyntax('raw')).toBeUndefined();
    expect(getFormatSyntax('custom')).toBeUndefined();
    // Not an `Object.prototype` member
    expect(getFormatSyntax('toString')).toBeUndefined();
  });
});
