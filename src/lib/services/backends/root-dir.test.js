import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fromRepoPath,
  getRootDir,
  isInRootDir,
  normalizeRootDir,
  toRepoChanges,
  toRepoPath,
} from '$lib/services/backends/root-dir';
import { cmsConfig } from '$lib/services/config';

/**
 * @import { FileChange } from '$lib/types/private';
 */

vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

/**
 * Configure the `root_dir` backend option.
 * @param {string | undefined} rootDir Option value.
 */
const setRootDir = (rootDir) => {
  // @ts-ignore Partial configuration
  cmsConfig.current = { backend: { name: 'github', repo: 'owner/repo', root_dir: rootDir } };
};

describe('normalizeRootDir()', () => {
  it('should strip leading, trailing and duplicate slashes', () => {
    expect(normalizeRootDir('/apps/site/')).toBe('apps/site');
    expect(normalizeRootDir('apps//site')).toBe('apps/site');
  });

  it('should drop `.` segments', () => {
    expect(normalizeRootDir('./apps/site')).toBe('apps/site');
    expect(normalizeRootDir('apps/./site')).toBe('apps/site');
  });

  it('should treat the repository root as no root directory', () => {
    expect(normalizeRootDir('')).toBe('');
    expect(normalizeRootDir('.')).toBe('');
    expect(normalizeRootDir('/')).toBe('');
    expect(normalizeRootDir('./')).toBe('');
  });

  it('should ignore a value that isn’t a string', () => {
    expect(normalizeRootDir(undefined)).toBe('');
    expect(normalizeRootDir(42)).toBe('');
  });
});

describe('getRootDir()', () => {
  it('should return the normalized option value', () => {
    setRootDir('/apps/site/');
    expect(getRootDir()).toBe('apps/site');
  });

  it('should return an empty string when the option isn’t set', () => {
    setRootDir(undefined);
    expect(getRootDir()).toBe('');
  });

  it('should return an empty string before the configuration is loaded', () => {
    cmsConfig.current = undefined;
    expect(getRootDir()).toBe('');
  });
});

describe('toRepoPath()', () => {
  it('should prefix the path with the root directory', () => {
    expect(toRepoPath('content/posts/hello.md', 'apps/site')).toBe(
      'apps/site/content/posts/hello.md',
    );
  });

  it('should resolve a path outside the root directory', () => {
    expect(toRepoPath('../other/data.json', 'apps/site')).toBe('apps/other/data.json');
    expect(toRepoPath('../../README.md', 'apps/site')).toBe('README.md');
  });

  it('should return the root directory itself for an empty path', () => {
    expect(toRepoPath('', 'apps/site')).toBe('apps/site');
  });

  it('should leave the path as it is without a root directory', () => {
    expect(toRepoPath('content/posts/hello.md', '')).toBe('content/posts/hello.md');
  });

  it('should use the configured root directory by default', () => {
    setRootDir('apps/site');
    expect(toRepoPath('static/logo.svg')).toBe('apps/site/static/logo.svg');
  });
});

describe('fromRepoPath()', () => {
  it('should strip the root directory from a path in it', () => {
    expect(fromRepoPath('apps/site/content/posts/hello.md', 'apps/site')).toBe(
      'content/posts/hello.md',
    );
  });

  it('should make a path outside the root directory start with `../`', () => {
    expect(fromRepoPath('apps/other/data.json', 'apps/site')).toBe('../other/data.json');
    expect(fromRepoPath('README.md', 'apps/site')).toBe('../../README.md');
    // A sibling whose name starts with the same characters is still outside
    expect(fromRepoPath('apps/site-2/index.md', 'apps/site')).toBe('../site-2/index.md');
  });

  it('should keep the file name of a file named like a directory on the way', () => {
    expect(fromRepoPath('apps/site', 'apps/site/content')).toBe('../../site');
  });

  it('should be reversed by `toRepoPath()`', () => {
    ['apps/site/a/b.md', 'apps/other/c.md', 'README.md', 'apps/site-2/d.md'].forEach((path) => {
      expect(toRepoPath(fromRepoPath(path, 'apps/site'), 'apps/site')).toBe(path);
    });
  });

  it('should leave the path as it is without a root directory', () => {
    expect(fromRepoPath('apps/site/index.md', '')).toBe('apps/site/index.md');
  });

  it('should use the configured root directory by default', () => {
    setRootDir('apps/site');
    expect(fromRepoPath('apps/site/static/logo.svg')).toBe('static/logo.svg');
  });
});

describe('isInRootDir()', () => {
  it('should tell a path in the root directory from one outside it', () => {
    expect(isInRootDir('content/posts/hello.md')).toBe(true);
    expect(isInRootDir('..data/file.md')).toBe(true);
    expect(isInRootDir('../other/data.json')).toBe(false);
  });
});

describe('toRepoChanges()', () => {
  beforeEach(() => {
    setRootDir('apps/site');
  });

  it('should convert the paths of the changes', () => {
    expect(
      toRepoChanges([
        { action: 'create', path: 'content/a.md', slug: 'a', data: 'A' },
        { action: 'move', path: 'static/b.png', previousPath: 'static/old/b.png' },
      ]),
    ).toEqual([
      { action: 'create', path: 'apps/site/content/a.md', slug: 'a', data: 'A' },
      {
        action: 'move',
        path: 'apps/site/static/b.png',
        previousPath: 'apps/site/static/old/b.png',
      },
    ]);
  });

  it('should not add a previous path to a change without one', () => {
    expect(toRepoChanges([{ action: 'delete', path: 'content/a.md' }])[0]).not.toHaveProperty(
      'previousPath',
    );
  });

  it('should return the same array without a root directory', () => {
    setRootDir(undefined);

    /** @type {FileChange[]} */
    const changes = [{ action: 'delete', path: 'content/a.md' }];

    expect(toRepoChanges(changes)).toBe(changes);
  });
});
