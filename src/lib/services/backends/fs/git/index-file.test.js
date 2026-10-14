import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  hasRequiredExtension,
  parseCacheTree,
  parseIndex,
  serializeIndex,
} from '$lib/services/backends/fs/git/index-file';
import { buildTree } from '$lib/services/backends/fs/git/tree';

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
      // No detached `git maintenance` after a commit
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'maintenance.auto',
      GIT_CONFIG_VALUE_0: 'false',
    },
    stdio: 'pipe',
  })
    .toString()
    .trim();

/**
 * Read the index of the test repository.
 * @returns {ArrayBuffer} Content.
 */
const readIndex = () => new Uint8Array(readFileSync(join(repoDir, '.git/index'))).buffer;

beforeEach(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'sveltia-git-index-'));
  git('init', '--initial-branch=main');
  mkdirSync(join(repoDir, 'content/日本語'), { recursive: true });
  writeFileSync(join(repoDir, 'README.md'), 'Readme\n');
  writeFileSync(join(repoDir, 'content/日本語/post.md'), 'Post\n');
  writeFileSync(join(repoDir, 'run.sh'), '#!/bin/sh\n', { mode: 0o755 });
  git('add', '.');
});

afterEach(() => {
  rmSync(repoDir, { recursive: true, force: true });
});

describe('parseIndex()', () => {
  test('parses the entries of a version 2 index', () => {
    const index = parseIndex(readIndex());

    expect(index.version).toBe(2);
    expect(index.extensions).toEqual([]);
    expect(index.entries.map(({ raw: _raw, ...entry }) => entry)).toEqual(
      git('ls-files', '--stage', '-z')
        .split('\0')
        .filter(Boolean)
        .map((line) => {
          const [info, path] = line.split('\t');
          const [mode, oid, stage] = info.split(' ');

          return { path, mode: Number.parseInt(mode, 8), oid, stage: Number(stage) };
        }),
    );
    expect(index.entries.map(({ path }) => path)).toEqual([
      'README.md',
      'content/日本語/post.md',
      'run.sh',
    ]);
  });

  test('lists the extensions', () => {
    git('-c', 'user.name=Jane', '-c', 'user.email=jane@example.com', 'commit', '-m', 'Initial');
    // Make Git write the cache tree
    git('read-tree', 'HEAD');

    const index = parseIndex(readIndex());

    expect(index.entries).toHaveLength(3);
    expect(index.extensions).toContain('TREE');
  });

  test('parses a path too long to have its length in the flags', () => {
    const path = `${'a'.repeat(4100)}.md`;
    const oid = git('hash-object', '-w', 'README.md');

    git('update-index', '--add', '--cacheinfo', `100644,${oid},${path}`);
    expect(parseIndex(readIndex()).entries.map((entry) => entry.path)).toContain(path);
  });

  test('parses the stages of a conflict', () => {
    git('-c', 'user.name=Jane', '-c', 'user.email=jane@example.com', 'commit', '-m', 'Initial');

    const oid = git('rev-parse', 'HEAD:README.md');

    execFileSync('git', ['update-index', '--index-info'], {
      cwd: repoDir,
      input: [
        `0 ${'0'.repeat(40)}\tREADME.md`,
        `100644 ${oid} 1\tREADME.md`,
        `100644 ${oid} 2\tREADME.md`,
      ].join('\n'),
    });

    expect(
      parseIndex(readIndex())
        .entries.filter(({ path }) => path === 'README.md')
        .map(({ stage }) => stage),
    ).toEqual([1, 2]);
  });

  test('leaves the entries of another version unparsed', () => {
    git('update-index', '--index-version', '4');
    expect(parseIndex(readIndex())).toEqual({ version: 4, entries: [], extensions: [] });
  });

  test('throws for a file that isn’t an index', () => {
    expect(() => parseIndex(new TextEncoder().encode('Not an index').buffer)).toThrow(
      'Invalid index file',
    );
  });
});

describe('parseCacheTree()', () => {
  test('reads the trees Git has cached in the index', () => {
    git('-c', 'user.name=Jane', '-c', 'user.email=jane@example.com', 'commit', '-m', 'Initial');
    // Make Git cache every tree
    git('read-tree', 'HEAD');

    expect(parseIndex(readIndex()).cacheTree).toEqual(
      new Map([
        ['', git('rev-parse', 'HEAD^{tree}')],
        ['content', git('rev-parse', 'HEAD:content')],
        ['content/日本語', git('rev-parse', 'HEAD:content/日本語')],
      ]),
    );
  });

  test('leaves out the trees invalidated since', () => {
    git('-c', 'user.name=Jane', '-c', 'user.email=jane@example.com', 'commit', '-m', 'Initial');
    git('read-tree', 'HEAD');
    writeFileSync(join(repoDir, 'content/日本語/post.md'), 'Changed\n');
    git('add', 'content/日本語/post.md');

    // The tree of the changed file and the ones above it are invalid
    expect(parseIndex(readIndex()).cacheTree).toEqual(new Map());
  });

  test('reads nothing from empty data', () => {
    expect(parseCacheTree(new Uint8Array())).toEqual(new Map());
  });

  test('leaves the cache out of an index without one', () => {
    expect(parseIndex(readIndex())).not.toHaveProperty('cacheTree');
  });
});

describe('serializeIndex()', () => {
  test('writes the entries back as they were read', async () => {
    const buffer = readIndex();

    expect(Buffer.from(await serializeIndex(parseIndex(buffer).entries))).toEqual(
      Buffer.from(buffer),
    );
  });

  test('writes an index Git reads, without the entries left out and the extensions', async () => {
    git('-c', 'user.name=Jane', '-c', 'user.email=jane@example.com', 'commit', '-m', 'Initial');
    git('read-tree', 'HEAD');

    const index = parseIndex(readIndex());

    expect(index.extensions).toContain('TREE');
    writeFileSync(
      join(repoDir, '.git/index'),
      await serializeIndex(index.entries.filter(({ path }) => path !== 'README.md')),
    );
    // Git checks the checksum when it reads the index
    expect(git('-c', 'core.quotePath=false', 'ls-files')).toBe('content/日本語/post.md\nrun.sh');
    expect(git('status', '--porcelain')).toBe('D  README.md\n?? README.md');
    expect(parseIndex(readIndex()).extensions).toEqual([]);
  });
});

describe('serializeIndex() with a tree', () => {
  /**
   * Get the ID of the tree Git builds from the files in the working tree, in an index of its own.
   * @returns {string} Tree ID.
   */
  const getFreshTreeOid = () => {
    const env = { ...process.env, GIT_INDEX_FILE: join(repoDir, '.git/fresh-index') };

    execFileSync('git', ['add', '-A'], { cwd: repoDir, env });

    const oid = execFileSync('git', ['write-tree'], { cwd: repoDir, env }).toString().trim();

    rmSync(join(repoDir, '.git/fresh-index'));

    return oid;
  };

  beforeEach(() => {
    ['content/a/b.md', 'content/a/c.md', 'content/d.md', 'e.md'].forEach((path) => {
      mkdirSync(join(repoDir, path, '..'), { recursive: true });
      writeFileSync(join(repoDir, path), `${path}\n`);
    });
    git('add', '.');
  });

  test('writes a cache tree Git reads as its own', async () => {
    const { entries } = parseIndex(readIndex());
    const tree = await buildTree(entries);

    writeFileSync(join(repoDir, '.git/index'), await serializeIndex(entries, { tree }));

    const index = parseIndex(readIndex());

    expect(index.extensions).toEqual(['TREE']);
    expect(index.cacheTree?.get('')).toBe(tree.oid);
    expect(index.cacheTree?.get('content/a')).toBe(
      tree.subtrees.get('content')?.subtrees.get('a')?.oid,
    );
    expect(git('write-tree')).toBe(getFreshTreeOid());
  });

  test('writes the entry counts Git relies on to update the cache', async () => {
    // Git only uses a cached tree whose object exists
    git('-c', 'user.name=Jane', '-c', 'user.email=jane@example.com', 'commit', '-m', 'Initial');

    const { entries } = parseIndex(readIndex());

    writeFileSync(
      join(repoDir, '.git/index'),
      await serializeIndex(entries, { tree: await buildTree(entries) }),
    );

    // Git invalidates the trees above the changed file, and builds them again from the entries,
    // skipping those of the subtrees that are still valid by their counts. (`git commit -a` would
    // build the whole cache again instead)
    writeFileSync(join(repoDir, 'content/d.md'), 'Changed\n');
    git('add', 'content/d.md');
    expect(git('write-tree')).toBe(getFreshTreeOid());
  });
});

describe('hasRequiredExtension()', () => {
  test('tells the extensions Git requires a reader to understand', () => {
    expect(hasRequiredExtension({ version: 2, entries: [], extensions: [] })).toBe(false);
    expect(hasRequiredExtension({ version: 2, entries: [], extensions: ['TREE', 'UNTR'] })).toBe(
      false,
    );
    expect(hasRequiredExtension({ version: 2, entries: [], extensions: ['TREE', 'link'] })).toBe(
      true,
    );
  });

  test('finds the extension of a split index', () => {
    git('update-index', '--split-index');
    expect(hasRequiredExtension(parseIndex(readIndex()))).toBe(true);
  });
});
