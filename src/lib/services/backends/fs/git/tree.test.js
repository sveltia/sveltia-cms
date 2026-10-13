/* eslint-disable jsdoc/require-jsdoc */

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { parseIndex } from '$lib/services/backends/fs/git/index-file';
import {
  buildTree,
  getCommitTree,
  parseTree,
  serializeTree,
  TREE_MODE,
  writeChangedTrees,
} from '$lib/services/backends/fs/git/tree';

/** @type {string} */
let repoDir;

/**
 * Run a Git command in the test repository.
 * @param {...string} args Arguments.
 * @returns {string} Output, trimmed.
 */
const git = (...args) =>
  execFileSync('git', args, {
    cwd: repoDir,
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Jane',
      GIT_AUTHOR_EMAIL: 'jane@example.com',
      GIT_COMMITTER_NAME: 'Jane',
      GIT_COMMITTER_EMAIL: 'jane@example.com',
    },
    stdio: 'pipe',
  })
    .toString()
    .trim();

/**
 * Write a file in the test repository.
 * @param {string} path Path relative to the repository root.
 * @param {string} [content] Content.
 */
const write = (path, content = `${path}\n`) => {
  mkdirSync(join(repoDir, path, '..'), { recursive: true });
  writeFileSync(join(repoDir, path), content);
};

/**
 * Build the tree of the test repository’s index.
 * @returns {ReturnType<typeof buildTree>} Tree.
 */
const buildIndexTree = () =>
  buildTree(parseIndex(new Uint8Array(readFileSync(join(repoDir, '.git/index'))).buffer).entries);

/**
 * Read an object from the test repository.
 * @param {string} oid Object ID.
 * @returns {Promise<{ type: string, content: Uint8Array }>} Object.
 */
const readObject = async (oid) => {
  const type = git('cat-file', '-t', oid);

  return {
    type,
    content: new Uint8Array(
      execFileSync('git', ['cat-file', type, oid], { cwd: repoDir, stdio: 'pipe' }),
    ),
  };
};

beforeEach(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'sveltia-git-tree-'));
  git('init', '--initial-branch=main');
});

afterEach(() => {
  rmSync(repoDir, { recursive: true, force: true });
});

describe('buildTree()', () => {
  test('builds the same trees as Git', async () => {
    // Names that sort differently as a file and as a directory, or as UTF-16 and as UTF-8
    ['a.b', 'a/c', 'a-b/c', 'a0', 'x', 'xy', 'b/c/d/e.md', 'ｚ.md', '😀.md', 'Z.md'].forEach(
      (path) => {
        write(path);
      },
    );
    write('run.sh', '#!/bin/sh\n');
    execFileSync('chmod', ['+x', join(repoDir, 'run.sh')]);
    symlinkSync('a.b', join(repoDir, 'link'));
    git('add', '.');
    // A submodule
    git('update-index', '--add', '--cacheinfo', `160000,${'1'.repeat(40)},sub`);

    const tree = await buildIndexTree();

    expect(tree.oid).toBe(git('write-tree'));
    expect(tree.subtrees.get('b')?.oid).toBe(git('rev-parse', `${tree.oid}:b`));
    expect(tree.entries.find(({ path }) => path === 'sub')).toEqual({
      mode: '160000',
      path: 'sub',
      oid: '1'.repeat(40),
      type: 'commit',
    });
    expect(tree.entries.find(({ path }) => path === 'b')).toMatchObject({
      mode: TREE_MODE,
      type: 'tree',
    });
  });

  test('builds the empty tree for an empty index', async () => {
    expect((await buildTree([])).oid).toBe('4b825dc642cb6eb9a060e54bf8d69288fbee4904');
  });
});

describe('buildTree() with a previous tree', () => {
  test('builds again only the directories of the changed files', async () => {
    ['a/b/c.md', 'a/d.md', 'e/f.md', 'g.md', 'h/i.md'].forEach((path) => write(path));
    git('add', '.');

    const previous = await buildIndexTree();

    // Change a file, add one in a new directory, and remove a whole directory
    write('a/b/c.md', 'Changed\n');
    write('j/k.md');
    git('add', 'a/b/c.md', 'j/k.md');
    git('rm', '-q', '--cached', 'h/i.md');

    const { entries } = parseIndex(
      new Uint8Array(readFileSync(join(repoDir, '.git/index'))).buffer,
    );

    const tree = await buildTree(entries, {
      previous,
      changedPaths: ['a/b/c.md', 'j/k.md', 'h/i.md'],
    });

    expect(tree.oid).toBe(git('write-tree'));
    expect(tree.oid).toBe((await buildTree(entries)).oid);
    // The unchanged directories are the same objects as before
    expect(tree.subtrees.get('e')).toBe(previous.subtrees.get('e'));
    expect(tree.subtrees.get('a')).not.toBe(previous.subtrees.get('a'));
    expect([...tree.subtrees.keys()].sort()).toEqual(['a', 'e', 'j']);
  });

  test('reuses the whole tree when nothing has changed', async () => {
    write('a/b.md');
    git('add', '.');

    const previous = await buildIndexTree();

    const { entries } = parseIndex(
      new Uint8Array(readFileSync(join(repoDir, '.git/index'))).buffer,
    );

    expect(await buildTree(entries, { previous })).toBe(previous);
  });
});

describe('buildTree() with a cache tree', () => {
  test('takes the IDs of the cached trees rather than hashing them', async () => {
    ['a/b/c.md', 'a/d.md', 'e/f.md'].forEach((path) => write(path));
    git('add', '.');

    const { entries } = parseIndex(
      new Uint8Array(readFileSync(join(repoDir, '.git/index'))).buffer,
    );

    const fakeOid = 'f'.repeat(40);
    const tree = await buildTree(entries, { cacheTree: new Map([['a', fakeOid]]) });

    // The cached ID is used as it is, and the trees above it are built from it
    expect(tree.subtrees.get('a')?.oid).toBe(fakeOid);
    expect(tree.subtrees.get('e')?.oid).toBe(git('rev-parse', `${git('write-tree')}:e`));
    expect(tree.oid).not.toBe(git('write-tree'));
  });
});

describe('serializeTree() and parseTree()', () => {
  test('serialize and parse the content of a tree object', () => {
    const entries = [
      { mode: '100644', path: 'a.md', oid: 'a'.repeat(40), type: /** @type {const} */ ('blob') },
      { mode: TREE_MODE, path: 'dir', oid: 'b'.repeat(40), type: /** @type {const} */ ('tree') },
    ];

    expect(parseTree(serializeTree(entries))).toEqual(
      new Map([
        ['a.md', { mode: '100644', oid: 'a'.repeat(40) }],
        ['dir', { mode: TREE_MODE, oid: 'b'.repeat(40) }],
      ]),
    );
    expect(parseTree(serializeTree([]))).toEqual(new Map());
  });
});

describe('getCommitTree()', () => {
  test('gets the tree of a commit', async () => {
    write('a.md');
    git('add', '.');
    git('commit', '-m', 'Initial');

    const { content } = await readObject(git('rev-parse', 'HEAD'));

    expect(getCommitTree(content)).toBe(git('rev-parse', 'HEAD^{tree}'));
    expect(getCommitTree(new TextEncoder().encode('Not a commit'))).toBeUndefined();
  });
});

describe('writeChangedTrees()', () => {
  /** @type {string[]} */
  let written;

  /**
   * Write a tree with Git, recording the names in it.
   * @param {import('$lib/types/private').GitTreeEntry[]} entries Entries.
   * @returns {Promise<string>} Tree ID.
   */
  const mktree = async (entries) => {
    written.push(entries.map(({ path }) => path).join());

    return execFileSync('git', ['mktree', '--missing'], {
      cwd: repoDir,
      input: entries
        .map(({ mode, type, oid, path }) => `${mode} ${type} ${oid}\t${path}\n`)
        .join(''),
    })
      .toString()
      .trim();
  };

  beforeEach(() => {
    written = [];
    ['a/b/c.md', 'a/d.md', 'e/f.md', 'g.md'].forEach((path) => write(path));
    git('add', '.');
    git('commit', '-m', 'Initial');
  });

  test('writes only the trees that differ from the base, as Git would', async () => {
    write('a/b/c.md', 'Changed\n');
    git('add', '.');

    const tree = await buildIndexTree();

    await writeChangedTrees(tree, git('rev-parse', 'HEAD^{tree}'), {
      readObject,
      writeTree: mktree,
    });

    // The deepest tree first, and not the `e` tree, which hasn’t changed
    expect(written).toEqual(['c.md', 'b,d.md', 'a,e,g.md']);
    expect(git('cat-file', '-t', tree.oid)).toBe('tree');
  });

  test('writes every tree without a base', async () => {
    await writeChangedTrees(await buildIndexTree(), undefined, { readObject, writeTree: mktree });
    expect(written).toEqual(['c.md', 'b,d.md', 'f.md', 'a,e,g.md']);
  });

  test('writes every tree when the base isn’t a tree', async () => {
    // e.g. a file replaced with a directory
    await writeChangedTrees(await buildIndexTree(), git('rev-parse', 'HEAD:g.md'), {
      readObject,
      writeTree: mktree,
    });

    expect(written).toEqual(['c.md', 'b,d.md', 'f.md', 'a,e,g.md']);
  });

  test('does nothing for a tree that matches the base', async () => {
    await writeChangedTrees(await buildIndexTree(), git('rev-parse', 'HEAD^{tree}'), {
      readObject,
      writeTree: mktree,
    });

    expect(written).toEqual([]);
  });

  test('throws if a written tree has an unexpected ID', async () => {
    write('g.md', 'Changed\n');
    git('add', '.');

    await expect(
      writeChangedTrees(await buildIndexTree(), git('rev-parse', 'HEAD^{tree}'), {
        readObject,
        writeTree: async () => 'f'.repeat(40),
      }),
    ).rejects.toThrow(/^Tree object ID mismatch: expected [0-9a-f]{40}, got f{40}$/);
  });
});
