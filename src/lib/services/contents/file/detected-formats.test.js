import { beforeEach, describe, expect, test } from 'vitest';

import {
  detectedFrontMatterFormats,
  getSavedFileConfig,
} from '$lib/services/contents/file/detected-formats';

/**
 * @import { FileConfig } from '$lib/types/private';
 */

/** @type {FileConfig} */
const FRONTMATTER_FILE = { extension: 'md', format: 'frontmatter', fmDelimiters: undefined };

describe('getSavedFileConfig()', () => {
  beforeEach(() => {
    detectedFrontMatterFormats.clear();
  });

  test('keeps the configuration of a collection in another format', () => {
    /** @type {FileConfig} */
    const _file = { extension: 'md', format: 'yaml-frontmatter', fmDelimiters: ['---', '---'] };

    detectedFrontMatterFormats.set('content/a.md', 'toml-frontmatter');

    expect(getSavedFileConfig({ _file, previousPath: 'content/a.md', path: 'content/a.md' })).toBe(
      _file,
    );
  });

  test('keeps the configuration for a new file, which gets YAML front matter', () => {
    expect(getSavedFileConfig({ _file: FRONTMATTER_FILE, path: 'content/new.md' })).toBe(
      FRONTMATTER_FILE,
    );
    expect(detectedFrontMatterFormats.has('content/new.md')).toBe(false);
  });

  test('keeps the configuration for a file whose format wasn’t detected', () => {
    expect(
      getSavedFileConfig({
        _file: FRONTMATTER_FILE,
        previousPath: 'content/a.md',
        path: 'content/a.md',
      }),
    ).toBe(FRONTMATTER_FILE);
  });

  test('saves an existing file in the format it was read in, with its default delimiters', () => {
    detectedFrontMatterFormats.set('content/a.md', 'toml-frontmatter');

    expect(
      getSavedFileConfig({
        _file: FRONTMATTER_FILE,
        previousPath: 'content/a.md',
        path: 'content/a.md',
      }),
    ).toEqual({ ...FRONTMATTER_FILE, format: 'toml-frontmatter', fmDelimiters: ['+++', '+++'] });
  });

  test('keeps the delimiters the collection sets', () => {
    detectedFrontMatterFormats.set('content/a.md', 'json-frontmatter');

    expect(
      getSavedFileConfig({
        _file: { ...FRONTMATTER_FILE, fmDelimiters: ['~~~', '~~~'] },
        previousPath: 'content/a.md',
        path: 'content/a.md',
      }),
    ).toEqual({ ...FRONTMATTER_FILE, format: 'json-frontmatter', fmDelimiters: ['~~~', '~~~'] });
  });

  test('passes the format on to the new path of a renamed file', () => {
    detectedFrontMatterFormats.set('content/a.md', 'toml-frontmatter');
    getSavedFileConfig({
      _file: FRONTMATTER_FILE,
      previousPath: 'content/a.md',
      path: 'content/b.md',
    });

    expect(detectedFrontMatterFormats.get('content/b.md')).toBe('toml-frontmatter');
  });
});
