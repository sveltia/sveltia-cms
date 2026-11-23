import { describe, expect, test } from 'vitest';

import { getSavedFileConfig } from '$lib/services/contents/file/detected-formats';

/**
 * @import { FileConfig } from '$lib/types/private';
 */

/** @type {FileConfig} */
const FRONTMATTER_FILE = { extension: 'md', format: 'frontmatter', fmDelimiters: undefined };

describe('getSavedFileConfig()', () => {
  test('keeps the configuration of a collection in another format', () => {
    /** @type {FileConfig} */
    const _file = { extension: 'md', format: 'yaml-frontmatter', fmDelimiters: ['---', '---'] };

    expect(getSavedFileConfig({ _file, format: 'toml-frontmatter' })).toBe(_file);
  });

  test('keeps the configuration for a file whose format wasn’t detected, e.g. a new file', () => {
    expect(getSavedFileConfig({ _file: FRONTMATTER_FILE })).toBe(FRONTMATTER_FILE);
  });

  test('saves an existing file in the format it was read in, with its default delimiters', () => {
    expect(getSavedFileConfig({ _file: FRONTMATTER_FILE, format: 'toml-frontmatter' })).toEqual({
      ...FRONTMATTER_FILE,
      format: 'toml-frontmatter',
      configuredFormat: 'frontmatter',
      fmDelimiters: ['+++', '+++'],
    });
  });

  test('keeps the delimiters the collection sets', () => {
    expect(
      getSavedFileConfig({
        _file: { ...FRONTMATTER_FILE, fmDelimiters: ['~~~', '~~~'] },
        format: 'json-frontmatter',
      }),
    ).toEqual({
      ...FRONTMATTER_FILE,
      format: 'json-frontmatter',
      configuredFormat: 'frontmatter',
      fmDelimiters: ['~~~', '~~~'],
    });
  });
});
