/* eslint-disable jsdoc/require-jsdoc */

import { describe, expect, test } from 'vitest';

import {
  findLfsTrackedPath,
  globToRegExp,
  parseFilterRules,
} from '$lib/services/backends/fs/git/attributes';

/**
 * Create a file system holding the given files.
 * @param {Record<string, string>} files File content, keyed by path.
 * @returns {any} File system.
 */
const createFileSystem = (files) => ({
  readFile: async (/** @type {string} */ path) => {
    if (path in files) {
      return files[path];
    }

    throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
  },
});

describe('globToRegExp()', () => {
  test.each([
    // Without a slash, the pattern matches the file name at any depth
    ['*.png', 'a.png', true],
    ['*.png', 'static/images/a.png', true],
    ['*.png', 'a.png.txt', false],
    ['a?.png', 'ab.png', true],
    ['a?.png', 'a/.png', false],
    ['image[0-9].png', 'image5.png', true],
    ['image[!0-9].png', 'image5.png', false],
    ['image[!0-9].png', 'imagex.png', true],
    ['a+b.png', 'a+b.png', true],
    ['a+b.png', 'aab.png', false],
    ['[a.png', '[a.png', true],
    // With a slash, the pattern is anchored to the directory
    ['/a.png', 'a.png', true],
    ['/a.png', 'dir/a.png', false],
    ['static/*.png', 'static/a.png', true],
    ['static/*.png', 'static/images/a.png', false],
    ['static/*.png', 'site/static/a.png', false],
    ['**/images/*.png', 'images/a.png', true],
    ['**/images/*.png', 'static/images/a.png', true],
    ['static/**', 'static/images/a.png', true],
    ['static/**/*.png', 'static/a.png', true],
    ['static/**/*.png', 'static/images/2026/a.png', true],
    ['a/**b', 'a/xb', true],
  ])('%s matches %s: %s', (pattern, path, expected) => {
    expect(globToRegExp(pattern).test(path)).toBe(expected);
  });
});

describe('parseFilterRules()', () => {
  test('parses the rules that set or unset the filter', () => {
    const rules = parseFilterRules(
      [
        '# Comment',
        '',
        '*.png filter=lfs diff=lfs merge=lfs -text',
        '*.md text eol=lf',
        '[attr]binary -diff -merge -text',
        '"quoted name.png" filter=lfs',
        'static/ filter=lfs',
        'small.png -filter',
        'other.png filter=other',
        'last.png filter=other filter=lfs',
      ].join('\r\n'),
    );

    expect(rules).toEqual([
      { regex: globToRegExp('*.png'), lfs: true },
      { regex: globToRegExp('small.png'), lfs: false },
      { regex: globToRegExp('other.png'), lfs: false },
      { regex: globToRegExp('last.png'), lfs: true },
    ]);
  });
});

describe('findLfsTrackedPath()', () => {
  test('finds a file tracked with Git LFS', async () => {
    const fs = createFileSystem({
      '.gitattributes': '*.png filter=lfs diff=lfs merge=lfs -text\n',
    });

    expect(await findLfsTrackedPath(fs, ['content/a.md', 'static/a.png'])).toBe('static/a.png');
    expect(await findLfsTrackedPath(fs, ['content/a.md'])).toBeUndefined();
    expect(await findLfsTrackedPath(fs, [])).toBeUndefined();
  });

  test('gives precedence to the deeper files, the later lines and `.git/info/attributes`', async () => {
    const fs = createFileSystem({
      '.gitattributes': '*.png filter=lfs\n',
      'static/.gitattributes': 'icons/*.png -filter\n',
      'static/icons/.gitattributes': 'large.png filter=lfs\n',
      '.git/info/attributes': 'static/icons/huge.png !filter\n',
    });

    expect(await findLfsTrackedPath(fs, ['static/a.png'])).toBe('static/a.png');
    expect(await findLfsTrackedPath(fs, ['static/icons/a.png'])).toBeUndefined();
    expect(await findLfsTrackedPath(fs, ['static/icons/large.png'])).toBe('static/icons/large.png');
    expect(await findLfsTrackedPath(fs, ['static/icons/huge.png'])).toBeUndefined();
  });

  test('reads each file once', async () => {
    const fs = createFileSystem({ '.gitattributes': '*.png filter=lfs\n' });
    const { readFile } = fs;
    /** @type {string[]} */
    const reads = [];

    fs.readFile = async (/** @type {string} */ path) => {
      reads.push(path);

      return readFile(path);
    };

    await findLfsTrackedPath(fs, ['a.md', 'b.md', 'c/d.md']);

    expect(reads).toEqual(['.gitattributes', '.git/info/attributes', 'c/.gitattributes']);
  });
});
