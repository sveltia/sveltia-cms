import { describe, expect, it } from 'vitest';

import { toFileListItems } from './tree';

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
