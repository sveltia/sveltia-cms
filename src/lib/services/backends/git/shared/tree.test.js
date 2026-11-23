import { describe, expect, it } from 'vitest';

import { toFileListItem, toFileListItems } from './tree';

describe('toFileListItems()', () => {
  it('converts the files in a tree to a file list', () => {
    expect(
      toFileListItems([
        { type: 'blob', path: 'content/posts/hello.md', sha: 'abc', size: 123 },
        { type: 'tree', path: 'content/posts', sha: 'def' },
        { type: 'commit', path: 'themes/default', sha: 'ghi' },
        { type: 'blob', path: 'README.md', sha: 'jkl' },
      ]),
    ).toEqual([
      { path: 'content/posts/hello.md', sha: 'abc', size: 123, name: 'hello.md' },
      { path: 'README.md', sha: 'jkl', size: 0, name: 'README.md' },
    ]);
  });
});

describe('toFileListItem()', () => {
  it('derives the file name from the path, with an empty SHA and size by default', () => {
    expect(toFileListItem('content/posts/hello.md')).toEqual({
      path: 'content/posts/hello.md',
      name: 'hello.md',
      sha: '',
      size: 0,
    });
  });

  it('keeps the given properties', () => {
    expect(
      toFileListItem('README.md', { sha: 'abc', size: 12, text: 'Hi', meta: undefined }),
    ).toEqual({ path: 'README.md', name: 'README.md', sha: 'abc', size: 12, text: 'Hi' });
  });
});
