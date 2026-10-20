/* eslint-disable jsdoc/require-jsdoc */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { loadChunk } from '$lib/services/app/dependencies';
import {
  clearLocalGitCache,
  getLocalGitStatus,
  localGitNotice,
  saveAndCommitChanges,
} from '$lib/services/backends/fs/git';
import { formatTimezoneOffset } from '$lib/services/backends/fs/git/commit';
import { parseIndex } from '$lib/services/backends/fs/git/index-file';
import { saveChanges } from '$lib/services/backends/fs/shared/save';
import { cmsConfig } from '$lib/services/config';
import { createGitEnv, createTempDir, runGitRaw, writeRepoFile } from '$lib/test/git-repo';
import { copyFromMemory, copyToMemory } from '$lib/test/memory-fs-handles';
import { createNodeDirectoryHandle } from '$lib/test/node-fs-handles';

/**
 * @import { FileChange } from '$lib/types/private';
 */

vi.mock('$lib/services/app/dependencies', async (importOriginal) => {
  /** @type {any} */
  const original = await importOriginal();

  return { ...original, loadChunk: vi.fn(original.loadChunk) };
});

vi.mock('$lib/services/backends/git/shared/commits', () => ({
  createCommitMessage: vi.fn(
    (/** @type {FileChange[]} */ changes) => `Update ${changes[0].path}\n\nSaved with the CMS`,
  ),
}));

// Commits made with the native Git are by a different author from the ones the CMS makes
const NATIVE_GIT_ENV = createGitEnv({ name: 'Native', email: 'native@example.com' });
/** @type {string} */
let repoDir;
/**
 * Run a Git command in the test repository.
 * @param {...string} args Arguments.
 * @returns {string} Output, trimmed.
 */
const git = (...args) => runGitRaw(repoDir, args, NATIVE_GIT_ENV).toString().trim();

/**
 * Write a file in the test repository.
 * @param {string} path Path relative to the repository root.
 * @param {string} content Content.
 */
const write = (path, content) => {
  writeRepoFile(repoDir, path, content);
};

/**
 * Create a function that saves changes to the test repository, like the local backend does, with
 * the paths relative to the given directory.
 * @param {FileChange[]} changes Changes.
 * @param {string} [rootDir] Root directory within the repository.
 * @returns {() => Promise<any>} Function.
 */
const createSave =
  (changes, rootDir = '') =>
  async () => {
    changes.forEach(({ action, path, previousPath, data }) => {
      if (previousPath) {
        unlinkSync(join(repoDir, rootDir, previousPath));
      }

      if (action === 'delete') {
        unlinkSync(join(repoDir, rootDir, path));
      } else {
        write(join(rootDir, path), /** @type {string} */ (data));
      }
    });

    return { sha: 'pseudo', files: {} };
  };

/**
 * Save and commit changes to the test repository.
 * @param {FileChange[]} changes Changes.
 * @returns {Promise<any>} Results.
 */
const saveAndCommit = (changes) =>
  saveAndCommitChanges({
    repoRootDirHandle: createNodeDirectoryHandle(repoDir),
    changes,
    options: { commitType: 'update' },
    save: createSave(changes),
  });

/**
 * Check that the repository is consistent and has no uncommitted changes.
 */
const expectCleanRepository = () => {
  expect(() => git('fsck', '--strict', '--no-dangling')).not.toThrow();
  expect(git('status', '--porcelain')).toBe('');
};

beforeEach(() => {
  repoDir = createTempDir('sveltia-git-');
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'Jane Doe');
  git('config', 'user.email', 'jane@example.com');
  write('content/posts/hello.md', '# Hello\n');
  write('static/images/logo.svg', '<svg/>\n');
  write('README.md', 'Readme\n');
  git('add', '.');
  git('commit', '-m', 'Initial commit');
  localGitNotice.current = undefined;
});

afterEach(() => {
  rmSync(repoDir, { recursive: true, force: true });
  cmsConfig.current = undefined;
});

describe('saveAndCommitChanges()', () => {
  test('commits a new file to the current branch', async () => {
    const parent = git('rev-parse', 'HEAD');

    const results = await saveAndCommit([
      { action: 'create', path: 'content/posts/new.md', slug: 'new', data: '# New\n' },
    ]);

    expect(results.sha).toBe(git('rev-parse', 'HEAD'));
    expect(results.date).toBeInstanceOf(Date);
    expect(git('rev-parse', 'HEAD~1')).toBe(parent);
    expect(git('log', '-1', '--format=%an <%ae>|%cn <%ce>')).toBe(
      'Jane Doe <jane@example.com>|Jane Doe <jane@example.com>',
    );
    expect(git('log', '-1', '--format=%B')).toBe(
      'Update content/posts/new.md\n\nSaved with the CMS',
    );
    expect(git('show', '--name-status', '--format=', 'HEAD')).toBe('A\tcontent/posts/new.md');
    expect(git('reflog', '-1', '--format=%gs')).toBe('commit: Update content/posts/new.md');
    expect(existsSync(join(repoDir, '.git/index.lock'))).toBe(false);
    expect(localGitNotice.current).toBeUndefined();
    expectCleanRepository();
  });

  test('commits updated, deleted and moved files', async () => {
    write('content/posts/other.md', 'Other\n');
    git('add', '.');
    git('commit', '-m', 'Add other');

    await saveAndCommit([
      { action: 'update', path: 'content/posts/hello.md', slug: 'hello', data: '# Hi\n' },
      { action: 'delete', path: 'static/images/logo.svg' },
      {
        action: 'move',
        path: 'content/archive/other.md',
        previousPath: 'content/posts/other.md',
        data: 'Other\n',
      },
    ]);

    expect(git('show', '-M', '--name-status', '--format=', 'HEAD').split('\n').sort()).toEqual([
      'D\tstatic/images/logo.svg',
      'M\tcontent/posts/hello.md',
      'R100\tcontent/posts/other.md\tcontent/archive/other.md',
    ]);
    expectCleanRepository();
  });

  test('commits to a repository whose objects are packed, with deltas', async () => {
    // Give the commits similar trees and messages, so Git stores them as deltas
    for (let index = 0; index < 20; index += 1) {
      write(`content/posts/post-${index}.md`, `Post ${index}\n${'Lorem ipsum. '.repeat(50)}\n`);
      git('add', '.');
      git('commit', '-m', `Add post ${index}\n\n${'A long description. '.repeat(20)}`);
    }

    git('repack', '-a', '-d', '-f', '--depth=50', '--window=250');
    git('prune-packed');

    expect(existsSync(join(repoDir, '.git/objects/pack'))).toBe(true);

    await saveAndCommit([
      { action: 'update', path: 'content/posts/post-3.md', slug: 'post-3', data: 'Updated\n' },
    ]);

    expect(git('show', '--name-status', '--format=', 'HEAD')).toBe('M\tcontent/posts/post-3.md');
    // Only the trees on the path to the changed file are written as loose objects
    expect(git('count-objects').split(' ')[0]).toBe('5');
    expectCleanRepository();
  });

  test('makes the first commit on a branch without commits', async () => {
    rmSync(join(repoDir, '.git'), { recursive: true });
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Jane Doe');
    git('config', 'user.email', 'jane@example.com');

    const results = await saveAndCommit([
      { action: 'create', path: 'content/posts/new.md', slug: 'new', data: '# New\n' },
    ]);

    expect(results.sha).toBe(git('rev-parse', 'HEAD'));
    expect(git('ls-tree', '-r', '--name-only', 'HEAD')).toBe('content/posts/new.md');
  });

  test('commits a deleted file', async () => {
    await saveAndCommit([{ action: 'delete', path: 'README.md' }]);

    expect(git('show', '--name-status', '--format=', 'HEAD')).toBe('D\tREADME.md');
    expectCleanRepository();
  });

  test('commits the reflogs Git keeps', async () => {
    unlinkSync(join(repoDir, '.git/logs/HEAD'));

    await saveAndCommit([{ action: 'update', path: 'README.md', data: 'Changed\n' }]);

    expect(existsSync(join(repoDir, '.git/logs/HEAD'))).toBe(false);
    expect(git('reflog', 'show', '-1', '--format=%gs', 'main')).toBe('commit: Update README.md');
  });

  test('keeps the commit if a reflog can’t be written', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // A reflog that can’t be added to
    unlinkSync(join(repoDir, '.git/logs/HEAD'));
    mkdirSync(join(repoDir, '.git/logs/HEAD'));

    const results = await saveAndCommit([{ action: 'update', path: 'README.md', data: 'New\n' }]);

    expect(results.sha).toBe(git('rev-parse', 'HEAD'));
    expect(git('log', '-1', '--format=%s')).toBe('Update README.md');
    // The index matches the new commit, rather than being put back
    expect(git('diff', '--cached', '--name-only')).toBe('');
    expect(localGitNotice.current).toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  test('leaves unstaged changes to other files out of the commit', async () => {
    write('README.md', 'Work in progress\n');

    await saveAndCommit([{ action: 'update', path: 'content/posts/hello.md', data: '# Hi\n' }]);

    expect(git('show', '--name-status', '--format=', 'HEAD')).toBe('M\tcontent/posts/hello.md');
    expect(git('status', '--porcelain')).toBe('M README.md');
  });

  test('commits files in the configured root directory', async () => {
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'github', root_dir: 'site' } });

    const changes = [{ action: /** @type {const} */ ('create'), path: 'index.md', data: 'Hi\n' }];

    await saveAndCommitChanges({
      repoRootDirHandle: createNodeDirectoryHandle(repoDir),
      changes,
      options: { commitType: 'create' },
      save: createSave(changes, 'site'),
    });

    expect(git('show', '--name-status', '--format=', 'HEAD')).toBe('A\tsite/index.md');
  });

  test('doesn’t commit a change Git doesn’t see', async () => {
    write('.gitignore', 'drafts/\n');
    git('add', '.');
    git('commit', '-m', 'Ignore drafts');

    const head = git('rev-parse', 'HEAD');

    const results = await saveAndCommit([
      { action: 'create', path: 'drafts/new.md', data: 'Draft\n' },
      { action: 'update', path: 'README.md', data: 'Readme\n' },
    ]);

    expect(results.sha).toBe('pseudo');
    expect(git('rev-parse', 'HEAD')).toBe(head);
    expect(localGitNotice.current).toBeUndefined();
  });

  test('updates and removes a file whose name is decomposed in the index', async () => {
    // A name with a combining accent, as Git keeps it when the file was added on Linux, or on macOS
    // with `core.precomposeUnicode` off
    const decomposed = 'content/posts/cafe\u0301.md';
    const composed = decomposed.normalize();

    git('config', 'core.precomposeUnicode', 'false');
    write(decomposed, 'Coffee\n');
    git('update-index', '--add', decomposed);
    git('commit', '-m', 'Add coffee');

    /**
     * Save a change made to the composed path, which the CMS uses, to the file on the disk.
     * @param {FileChange} change Change.
     * @returns {Promise<any>} Results.
     */
    const saveDecomposed = (change) =>
      saveAndCommitChanges({
        repoRootDirHandle: createNodeDirectoryHandle(repoDir),
        changes: [change],
        options: { commitType: 'update' },
        save: async () => {
          if (change.action === 'delete') {
            unlinkSync(join(repoDir, decomposed));
          } else {
            write(decomposed, /** @type {string} */ (change.data));
          }

          return { sha: 'pseudo', files: {} };
        },
      });

    await saveDecomposed({ action: 'update', path: composed, data: 'Tea\n' });
    // The entry is updated rather than joined by another one with the composed name
    expect(git('-c', 'core.quotePath=false', 'ls-files', 'content/posts')).toBe(
      ['content/posts/cafe\u0301.md', 'content/posts/hello.md'].join('\n'),
    );
    expect(git('show', `HEAD:${decomposed}`)).toBe('Tea');

    clearLocalGitCache();
    await saveDecomposed({ action: 'delete', path: composed });
    expect(git('ls-files', 'content/posts')).toBe('content/posts/hello.md');
    expectCleanRepository();
  });

  test('puts a new file in the folder the index spells decomposed', async () => {
    const folder = 'content/cafe\u0301';

    git('config', 'core.precomposeUnicode', 'false');
    write(`${folder}/a.md`, 'A\n');
    git('update-index', '--add', `${folder}/a.md`);
    git('commit', '-m', 'Add a folder with a decomposed name');

    const changes = [
      { action: /** @type {const} */ ('create'), path: `${folder.normalize()}/b.md`, data: 'B\n' },
    ];

    await saveAndCommitChanges({
      repoRootDirHandle: createNodeDirectoryHandle(repoDir),
      changes,
      options: { commitType: 'create' },
      // The folder is the same one on a file system that ignores the normalization, like macOS
      save: async () => {
        write(`${folder}/b.md`, 'B\n');

        return { sha: 'pseudo', files: {} };
      },
    });

    // One folder with both files, rather than two folders that look the same
    expect(git('-c', 'core.quotePath=false', 'ls-tree', '--name-only', 'HEAD', 'content/')).toBe(
      [folder, 'content/posts'].join('\n'),
    );
    expect(git('-c', 'core.quotePath=false', 'ls-files', folder)).toBe(
      [`${folder}/a.md`, `${folder}/b.md`].join('\n'),
    );
    expectCleanRepository();
  });

  test('keeps the executable bit of a file it updates', async () => {
    write('run.sh', '#!/bin/sh\n');
    execFileSync('chmod', ['+x', join(repoDir, 'run.sh')]);
    git('add', 'run.sh');
    git('commit', '-m', 'Add a script');

    await saveAndCommit([{ action: 'update', path: 'run.sh', data: '#!/bin/sh\necho hi\n' }]);

    expect(git('ls-tree', 'HEAD', 'run.sh')).toMatch(/^100755 blob /);
    expect(git('show', '--format=', '--summary', 'HEAD')).toBe('');
  });

  test.each(['true', 'input'])(
    'stores text with LF line endings when `core.autocrlf` is %s',
    async (value) => {
      git('config', 'core.autocrlf', value);

      const binary = Buffer.from([0xff, 0xfe, 0x0d, 0x0a, 0x00]);

      const changes = [
        { action: /** @type {const} */ ('create'), path: 'crlf.md', data: 'One\r\nTwo\r\n' },
        { action: /** @type {const} */ ('create'), path: 'binary.bin', data: '' },
      ];

      await saveAndCommitChanges({
        repoRootDirHandle: createNodeDirectoryHandle(repoDir),
        changes,
        options: { commitType: 'create' },
        save: async () => {
          write('crlf.md', 'One\r\nTwo\r\n');
          writeFileSync(join(repoDir, 'binary.bin'), binary);

          return { sha: 'pseudo', files: {} };
        },
      });

      expect(
        execFileSync('git', ['cat-file', 'blob', 'HEAD:crlf.md'], { cwd: repoDir }).toString(),
      ).toBe('One\nTwo\n');
      // Content that isn’t text is stored as it is
      expect(
        execFileSync('git', ['cat-file', 'blob', 'HEAD:binary.bin'], { cwd: repoDir }),
      ).toEqual(binary);
    },
  );

  test('leaves a cache tree that Git can commit on top of', async () => {
    write('content/notes/a.md', 'A\n');
    git('add', '.');
    git('commit', '-m', 'Add notes');

    await saveAndCommit([
      { action: 'update', path: 'content/posts/hello.md', data: '# Hi\n' },
      { action: 'create', path: 'content/pages/about.md', data: 'About\n' },
      { action: 'delete', path: 'static/images/logo.svg' },
    ]);

    expect(
      parseIndex(new Uint8Array(readFileSync(join(repoDir, '.git/index'))).buffer).extensions,
    ).toEqual(['TREE']);

    // A native commit uses the cache, and the entry counts in it, for the trees it doesn’t touch.
    // (`git commit -a` would build the whole cache again instead)
    write('content/notes/a.md', 'Changed\n');
    git('add', 'content/notes/a.md');
    git('commit', '-qm', 'Native');

    const env = { ...NATIVE_GIT_ENV, GIT_INDEX_FILE: join(repoDir, '.git/fresh-index') };

    execFileSync('git', ['add', '-A'], { cwd: repoDir, env });
    expect(git('rev-parse', 'HEAD^{tree}')).toBe(
      execFileSync('git', ['write-tree'], { cwd: repoDir, env }).toString().trim(),
    );
    rmSync(join(repoDir, '.git/fresh-index'));
    expectCleanRepository();

    // The next save after a Git command reads the cache back
    clearLocalGitCache();
    git('status', '--porcelain');
    await saveAndCommit([{ action: 'update', path: 'README.md', data: 'Changed\n' }]);
    expect(git('log', '-1', '--format=%s')).toBe('Update README.md');
    expectCleanRepository();
  });

  test('notices changes the user stages between two saves', async () => {
    await saveAndCommit([{ action: 'update', path: 'README.md', data: 'First\n' }]);
    expect(localGitNotice.current).toBeUndefined();

    write('content/posts/hello.md', '# Staged\n');
    git('add', 'content/posts/hello.md');

    const head = git('rev-parse', 'HEAD');

    await saveAndCommit([{ action: 'update', path: 'README.md', data: 'Second\n' }]);
    expect(localGitNotice.current).toEqual({ reason: 'staged_changes', detail: undefined });
    expect(git('rev-parse', 'HEAD')).toBe(head);
  });

  test('leaves the index alone when only an ignored file is saved', async () => {
    write('.gitignore', 'drafts/\n');
    git('add', '.');
    git('commit', '-m', 'Ignore drafts');

    const index = readFileSync(join(repoDir, '.git/index'));
    const results = await saveAndCommit([{ action: 'create', path: 'drafts/a.md', data: 'A\n' }]);

    expect(results.sha).toBe('pseudo');
    expect(readFileSync(join(repoDir, '.git/index'))).toEqual(index);
  });

  test('runs one operation at a time', async () => {
    await Promise.all([
      saveAndCommit([{ action: 'create', path: 'a.md', data: 'A\n' }]),
      saveAndCommit([{ action: 'create', path: 'b.md', data: 'B\n' }]),
    ]);

    expect(git('log', '-2', '--format=%s')).toBe('Update b.md\nUpdate a.md');
    expectCleanRepository();
  });

  describe('saves without committing', () => {
    /**
     * Save a change, and check that it’s saved but not committed, for the given reason.
     * @param {string} reason Expected reason.
     * @param {string} [detail] Expected detail.
     */
    const expectSkipped = async (reason, detail) => {
      const head = git('rev-parse', 'HEAD');

      const results = await saveAndCommit([
        { action: 'update', path: 'content/posts/hello.md', data: '# Hi\n' },
      ]);

      expect(results.sha).toBe('pseudo');
      expect(readFileSync(join(repoDir, 'content/posts/hello.md'), 'utf8')).toBe('# Hi\n');
      expect(git('rev-parse', 'HEAD')).toBe(head);
      expect(localGitNotice.current).toEqual({ reason, detail });
      // The CMS only removes its own lock
      expect(existsSync(join(repoDir, '.git/index.lock'))).toBe(reason === 'locked');
    };

    test('when the user has staged changes', async () => {
      write('README.md', 'Staged\n');
      git('add', 'README.md');
      await expectSkipped('staged_changes');
      // The user’s staged change is kept as it was
      expect(git('diff', '--cached', '--name-only')).toBe('README.md');
    });

    test('when the user has staged a change on a branch without commits', async () => {
      rmSync(join(repoDir, '.git'), { recursive: true });
      git('init', '--initial-branch=main');
      git('config', 'user.name', 'Jane Doe');
      git('config', 'user.email', 'jane@example.com');
      git('add', 'README.md');

      const results = await saveAndCommit([{ action: 'create', path: 'a.md', data: 'A\n' }]);

      expect(results.sha).toBe('pseudo');
      expect(localGitNotice.current).toEqual({ reason: 'staged_changes', detail: undefined });
    });

    test('when the identity isn’t configured in the repository', async () => {
      git('config', '--unset', 'user.email');
      await expectSkipped('missing_identity');
    });

    test('when another Git process holds the lock', async () => {
      write('.git/index.lock', '');
      await expectSkipped('locked');
      expect(existsSync(join(repoDir, '.git/index.lock'))).toBe(true);
    });

    test.each([
      ['a merge', 'MERGE_HEAD', 'merge'],
      ['a cherry-pick', 'CHERRY_PICK_HEAD', 'cherry_pick'],
      ['a revert', 'REVERT_HEAD', 'revert'],
    ])('when %s is in progress', async (_, marker, operation) => {
      write(`.git/${marker}`, `${git('rev-parse', 'HEAD')}\n`);
      await expectSkipped('operation_in_progress', operation);
    });

    test.each([
      ['a sequence of cherry-picks', 'pick 1234567 Subject\n', 'cherry_pick'],
      ['a sequence of reverts', 'revert 1234567 Subject\n', 'revert'],
    ])('when %s is paused', async (_, todo, operation) => {
      write('.git/sequencer/todo', todo);
      await expectSkipped('operation_in_progress', operation);
    });

    test('when a sequence is paused without its list', async () => {
      write('.git/sequencer/head', `${git('rev-parse', 'HEAD')}\n`);
      await expectSkipped('operation_in_progress', 'cherry_pick');
    });

    test.each([
      ['an interactive rebase', 'rebase-merge/head-name', 'rebase'],
      ['a rebase with the apply backend', 'rebase-apply/head-name', 'rebase'],
      ['git am', 'rebase-apply/applying', 'am'],
    ])('when %s is in progress', async (_, marker, operation) => {
      write(`.git/${marker}`, '');
      await expectSkipped('operation_in_progress', operation);
    });

    test('when there’s a conflict', async () => {
      git('checkout', '-b', 'other');
      write('README.md', 'Other\n');
      git('commit', '-am', 'Other');
      git('checkout', 'main');
      write('README.md', 'Main\n');
      git('commit', '-am', 'Main');
      expect(() => git('merge', 'other')).toThrow();
      unlinkSync(join(repoDir, '.git/MERGE_HEAD'));
      await expectSkipped('operation_in_progress', 'conflict');
    });

    test('when no branch is checked out', async () => {
      git('checkout', '--detach');
      await expectSkipped('detached_head');
    });

    test('when the repository is a linked worktree', async () => {
      const worktreeDir = `${repoDir}-worktree`;

      git('worktree', 'add', worktreeDir);

      const mainDir = repoDir;

      repoDir = worktreeDir;

      try {
        await expectSkipped('unsupported_repository');
      } finally {
        repoDir = mainDir;
        rmSync(worktreeDir, { recursive: true, force: true });
      }
    });

    test('when the index is in a format isomorphic-git can’t write', async () => {
      git('update-index', '--index-version', '4');
      await expectSkipped('unsupported_repository');
    });

    test('when the index is split', async () => {
      git('update-index', '--split-index');
      await expectSkipped('unsupported_repository');
    });

    test('when the current commit can’t be found', async () => {
      const head = git('rev-parse', 'HEAD');

      rmSync(join(repoDir, '.git/objects', head.slice(0, 2), head.slice(2)));
      await expectSkipped('unsupported_repository');
    });

    test('when a saved file is tracked with Git LFS', async () => {
      write('.gitattributes', '*.md filter=lfs diff=lfs merge=lfs -text\n');
      git('add', '.');
      git('commit', '-m', 'Track Markdown with LFS');
      await expectSkipped('lfs', 'content/posts/hello.md');
    });

    test('when the Git library can’t be loaded', async () => {
      vi.mocked(loadChunk).mockRejectedValueOnce(new Error('Failed to load the git chunk.'));
      await expectSkipped('error', 'Failed to load the git chunk.');
      vi.mocked(loadChunk).mockRejectedValueOnce('Offline');
      await expectSkipped('error', 'Offline');
    });

    test('when the index can’t be read', async () => {
      rmSync(join(repoDir, '.git/index'));
      mkdirSync(join(repoDir, '.git/index'));
      await expectSkipped('error', expect.stringContaining('Not a file'));
    });

    test('when the repository can’t be inspected', async () => {
      writeFileSync(join(repoDir, '.git/index'), 'Not an index');
      await expectSkipped('error', 'Invalid index file');
    });
  });

  describe('matches the `.gitattributes` patterns like Git with `core.ignorecase`', () => {
    const path = 'static/images/IMG_1234.JPG';

    /**
     * Replace the `core.ignorecase` option in the repository’s configuration, keeping the other
     * options in the `core` section, which `git init` writes.
     * @param {string} [line] Line setting the option, or nothing to leave it unset.
     */
    const setIgnoreCase = (line) => {
      const configPath = join(repoDir, '.git/config');
      const config = readFileSync(configPath, 'utf8').replace(/^\s*ignorecase\b.*\n/gim, '');

      writeFileSync(configPath, line ? config.replace('[core]\n', `[core]\n\t${line}\n`) : config);
    };

    beforeEach(() => {
      write('.gitattributes', '*.jpg filter=lfs diff=lfs merge=lfs -text\n');
      git('add', '.');
      git('commit', '-m', 'Track JPEG with LFS');
    });

    test.each([
      [undefined, false],
      ['ignorecase = true', true],
      ['ignorecase = false', false],
      ['ignorecase = True', true],
      ['ignorecase = yes', true],
      ['ignorecase = off', false],
      ['ignorecase', true],
      ['ignoreCase = TRUE', true],
      ['ignoreCase = 1', true],
      ['ignoreCase = 0', false],
      ['ignorecase = 0', false],
    ])('%s: tracked with Git LFS: %s', async (line, tracked) => {
      setIgnoreCase(line);
      // The expectation is the same as Git’s
      expect(git('check-attr', 'filter', '--', path)).toBe(
        `${path}: filter: ${tracked ? 'lfs' : 'unspecified'}`,
      );

      const head = git('rev-parse', 'HEAD');
      const results = await saveAndCommit([{ action: 'create', path, data: 'JPEG\n' }]);

      if (tracked) {
        expect(results.sha).toBe('pseudo');
        expect(git('rev-parse', 'HEAD')).toBe(head);
        expect(localGitNotice.current).toEqual({ reason: 'lfs', detail: path });
      } else {
        expect(results.sha).toBe(git('rev-parse', 'HEAD'));
        expect(git('show', '--name-status', '--format=', 'HEAD')).toBe(`A\t${path}`);
        expect(localGitNotice.current).toBeUndefined();
      }
    });

    test('reads a number isomorphic-git can’t convert as false (known issue)', async () => {
      // Git reads it as true, but never writes it itself
      setIgnoreCase('ignorecase = 1');
      expect(git('check-attr', 'filter', '--', path)).toBe(`${path}: filter: lfs`);

      const results = await saveAndCommit([{ action: 'create', path, data: 'JPEG\n' }]);

      expect(results.sha).toBe(git('rev-parse', 'HEAD'));
      expect(localGitNotice.current).toBeUndefined();
    });
  });

  test('reports a commit that fails, keeping the saved changes', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const head = git('rev-parse', 'HEAD');
    const changes = [{ action: /** @type {const} */ ('update'), path: 'README.md', data: 'Hi\n' }];
    const save = createSave(changes);

    const results = await saveAndCommitChanges({
      repoRootDirHandle: createNodeDirectoryHandle(repoDir),
      changes,
      options: { commitType: 'update' },
      save: async () => {
        // Native Git can’t commit while the index is locked
        expect(() => git('commit', '--allow-empty', '-m', 'Other')).toThrow();
        // Another program updates the branch in the meantime, ignoring the lock
        git(
          'update-ref',
          'refs/heads/main',
          git('commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'Other'),
        );

        return save();
      },
    });

    expect(results.sha).toBe('pseudo');
    expect(git('log', '-1', '--format=%s')).toBe('Other');
    expect(git('rev-parse', 'HEAD~1')).toBe(head);
    expect(readFileSync(join(repoDir, 'README.md'), 'utf8')).toBe('Hi\n');
    // The change staged for the commit is unstaged again, so it doesn’t stop the next commit
    expect(git('diff', '--cached', '--name-only')).toBe('');
    expect(git('diff', '--name-only')).toBe('README.md');
    expect(localGitNotice.current).toEqual({
      reason: 'error',
      detail: 'The branch has been updated by another program.',
    });
    expect(consoleError).toHaveBeenCalled();
    expect(existsSync(join(repoDir, '.git/index.lock'))).toBe(false);
    consoleError.mockRestore();
  });

  test('reports a branch that can’t be read before the commit as such', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const head = git('rev-parse', 'HEAD');
    /** @type {any} */
    const realGit = await loadChunk('git');

    const resolveRef = vi
      .fn(realGit.resolveRef)
      .mockImplementationOnce(realGit.resolveRef)
      .mockRejectedValueOnce(new Error('Disk failure'));

    vi.mocked(loadChunk).mockResolvedValueOnce({ ...realGit, resolveRef });

    const results = await saveAndCommit([{ action: 'update', path: 'README.md', data: 'Hi\n' }]);

    expect(results.sha).toBe('pseudo');
    expect(git('rev-parse', 'HEAD')).toBe(head);
    expect(resolveRef).toHaveBeenCalledTimes(2);
    expect(localGitNotice.current).toEqual({ reason: 'error', detail: 'Disk failure' });
    consoleError.mockRestore();
  });

  test('removes the index a failed commit created', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    rmSync(join(repoDir, '.git'), { recursive: true });
    git('init', '--initial-branch=main');
    git('config', 'user.name', 'Jane Doe');
    git('config', 'user.email', 'jane@example.com');

    const changes = [{ action: /** @type {const} */ ('create'), path: 'a.md', data: 'A\n' }];
    const save = createSave(changes);

    await saveAndCommitChanges({
      repoRootDirHandle: createNodeDirectoryHandle(repoDir),
      changes,
      options: { commitType: 'create' },
      save: async () => {
        // Another program makes the first commit in the meantime
        git('update-ref', 'refs/heads/main', git('commit-tree', git('mktree'), '-m', 'Other'));

        return save();
      },
    });

    expect(localGitNotice.current?.reason).toBe('error');
    expect(existsSync(join(repoDir, '.git/index'))).toBe(false);

    // A commit that fails before the index is created leaves nothing to remove
    await saveAndCommitChanges({
      repoRootDirHandle: createNodeDirectoryHandle(repoDir),
      changes: [{ action: 'create', path: 'missing.md', data: 'Missing\n' }],
      options: { commitType: 'create' },
      save: async () => ({ sha: 'pseudo', files: {} }),
    });

    expect(localGitNotice.current?.reason).toBe('error');
    expect(existsSync(join(repoDir, '.git/index'))).toBe(false);
    consoleError.mockRestore();
  });

  test('throws if the changes can’t be saved, releasing the lock', async () => {
    await expect(
      saveAndCommitChanges({
        repoRootDirHandle: createNodeDirectoryHandle(repoDir),
        changes: [{ action: 'update', path: 'README.md', data: 'Hi\n' }],
        options: { commitType: 'update' },
        save: async () => {
          throw new Error('Disk full');
        },
      }),
    ).rejects.toThrow('Disk full');

    expect(existsSync(join(repoDir, '.git/index.lock'))).toBe(false);

    // The queue moves on to the next operation
    await saveAndCommit([{ action: 'update', path: 'README.md', data: 'Hi\n' }]);
    expect(git('log', '-1', '--format=%s')).toBe('Update README.md');
  });

  test('throws if the changes can’t be saved when they’re not committed', async () => {
    git('config', '--unset', 'user.name');

    await expect(
      saveAndCommitChanges({
        repoRootDirHandle: createNodeDirectoryHandle(repoDir),
        changes: [{ action: 'update', path: 'README.md', data: 'Hi\n' }],
        options: { commitType: 'update' },
        save: async () => {
          throw new Error('Disk full');
        },
      }),
    ).rejects.toThrow('Disk full');
  });
});

describe('saveAndCommitChanges() on a file system that compares names byte for byte', () => {
  // A name with a combining accent, as a file added on Linux can have, and its spelling in form C,
  // which the CMS uses
  const decomposed = 'cafe\u0301';
  const composed = decomposed.normalize();

  beforeEach(() => {
    git('config', 'core.precomposeUnicode', 'false');
    // The save renames its temporary file with `move()`
    vi.stubGlobal('FileSystemFileHandle', { prototype: { move: () => {} } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Save and commit changes with the local backend’s own save, in a copy of the test repository
   * kept in memory, where a name in form D isn’t found by its name in form C, as on Linux. The copy
   * is then written back, so the repository can be checked with the `git` command.
   * @param {FileChange[]} changes Changes.
   */
  const saveAndCommitInMemory = async (changes) => {
    const repoRootDirHandle = await copyToMemory(repoDir);

    clearLocalGitCache();
    await saveAndCommitChanges({
      repoRootDirHandle,
      changes,
      options: { commitType: 'update' },
      save: () => saveChanges(repoRootDirHandle, changes),
    });
    expect(localGitNotice.current).toBeUndefined();

    rmSync(repoDir, { recursive: true, force: true });
    await copyFromMemory(repoRootDirHandle, repoDir);
  };

  /**
   * List the files in the index.
   * @param {string} path Folder to list.
   * @returns {string} File paths, one per line.
   */
  const listFiles = (path) => git('-c', 'core.quotePath=false', 'ls-files', path);

  test('commits an edit to a tracked file whose name is decomposed', async () => {
    const path = `content/posts/${decomposed}.md`;

    write(path, 'Coffee\n');
    git('update-index', '--add', path);
    git('commit', '-m', 'Add coffee');

    await saveAndCommitInMemory([{ action: 'update', path: path.normalize(), data: 'Tea\n' }]);
    expect(listFiles('content/posts')).toBe([path, 'content/posts/hello.md'].join('\n'));
    expect(git('show', `HEAD:${path}`)).toBe('Tea');
    expectCleanRepository();

    await saveAndCommitInMemory([{ action: 'delete', path: path.normalize() }]);
    expect(listFiles('content/posts')).toBe('content/posts/hello.md');
    expectCleanRepository();
  });

  test('stages an untracked file with the name it has on the disk', async () => {
    const path = `content/${decomposed}/${decomposed}.md`;

    write(path, 'Coffee\n');

    await saveAndCommitInMemory([{ action: 'update', path: path.normalize(), data: 'Tea\n' }]);
    expect(listFiles(`content/${decomposed}`)).toBe(path);
    expect(git('show', `HEAD:${path}`)).toBe('Tea');
    expectCleanRepository();
  });

  test('reports a saved file that can’t be found', async () => {
    const path = `content/${composed}/${composed}.md`;
    const changes = [{ action: /** @type {const} */ ('create'), path, data: 'Tea\n' }];

    await saveAndCommitChanges({
      repoRootDirHandle: await copyToMemory(repoDir),
      changes,
      options: { commitType: 'create' },
      // The file isn’t written, e.g. because it’s been removed right away by another program
      save: async () => ({ sha: 'pseudo', files: {} }),
    });
    expect(localGitNotice.current).toEqual({ reason: 'error', detail: `ENOENT: ${path}` });
  });

  test('stages a new file in an untracked folder whose name is decomposed', async () => {
    const folder = `content/${decomposed}`;

    write(`${folder}/a.md`, 'A\n');

    await saveAndCommitInMemory([
      { action: 'create', path: `${folder.normalize()}/b.md`, data: 'B\n' },
      { action: 'create', path: `content/${composed}-new.md`, data: 'C\n' },
    ]);
    // The new file goes in the folder, and a new name is in form C
    expect(listFiles('content')).toBe(
      [`${folder}/b.md`, `content/${composed}-new.md`, 'content/posts/hello.md'].join('\n'),
    );
    expect(git('-c', 'core.quotePath=false', 'status', '--porcelain', '-uall')).toBe(
      `?? ${folder}/a.md`,
    );
  });
});

describe('getLocalGitStatus()', () => {
  /**
   * Create a handle of the test repository whose `.git` folder, or a file in it, can’t be read.
   * @param {object} failures Failures.
   * @param {boolean} [failures.gitDir] Whether the `.git` folder can’t be read.
   * @param {string} [failures.file] Name of a file in `.git` that can’t be read.
   * @returns {FileSystemDirectoryHandle} Handle.
   */
  const createUnreadableHandle = ({ gitDir = false, file = undefined }) => {
    const handle = createNodeDirectoryHandle(repoDir);
    const unreadable = new DOMException('Unreadable', 'NotReadableError');

    return /** @type {any} */ ({
      ...handle,
      getDirectoryHandle: async (/** @type {string} */ name, /** @type {any} */ options) => {
        const dirHandle = await handle.getDirectoryHandle(name, options);

        if (name !== '.git') {
          return dirHandle;
        }

        if (gitDir) {
          throw unreadable;
        }

        return {
          ...dirHandle,
          getFileHandle: async (/** @type {string} */ fileName, /** @type {any} */ opts) => {
            if (fileName === file) {
              throw unreadable;
            }

            return dirHandle.getFileHandle(fileName, opts);
          },
        };
      },
    });
  };

  test('reports a `.git` folder or a lock file that can’t be read as an error', async () => {
    expect(await getLocalGitStatus(createUnreadableHandle({ gitDir: true }))).toEqual({
      ready: false,
      reason: 'error',
      detail: 'Unreadable',
    });
    expect(await getLocalGitStatus(createUnreadableHandle({ file: 'index.lock' }))).toEqual({
      ready: false,
      reason: 'error',
      detail: 'Unreadable',
    });
  });

  test('waits for a save in progress', async () => {
    const changes = [{ action: /** @type {const} */ ('update'), path: 'README.md', data: 'Hi\n' }];

    const saving = saveAndCommitChanges({
      repoRootDirHandle: createNodeDirectoryHandle(repoDir),
      changes,
      options: { commitType: 'update' },
      save: createSave(changes),
    });

    // The CMS’s own lock isn’t reported as another Git process’s
    expect(await getLocalGitStatus(createNodeDirectoryHandle(repoDir))).toMatchObject({
      ready: true,
    });
    await saving;
  });

  test('returns the branch and author when the changes can be committed', async () => {
    expect(await getLocalGitStatus(createNodeDirectoryHandle(repoDir))).toEqual({
      ready: true,
      branch: 'refs/heads/main',
      author: { name: 'Jane Doe', email: 'jane@example.com' },
    });
  });

  test('returns the reason when they can’t', async () => {
    write('README.md', 'Staged\n');
    git('add', 'README.md');

    expect(await getLocalGitStatus(createNodeDirectoryHandle(repoDir))).toEqual({
      ready: false,
      reason: 'staged_changes',
      branch: 'refs/heads/main',
      author: { name: 'Jane Doe', email: 'jane@example.com' },
    });
  });

  test.each([
    ['SHA-256 object IDs', '--object-format=sha256'],
    ['the reftable format', '--ref-format=reftable'],
  ])('reports a repository with %s as unsupported', async (_, option) => {
    rmSync(join(repoDir, '.git'), { recursive: true });
    git('init', '--initial-branch=main', option);
    git('config', 'user.name', 'Jane Doe');
    git('config', 'user.email', 'jane@example.com');

    expect(await getLocalGitStatus(createNodeDirectoryHandle(repoDir))).toEqual({
      ready: false,
      reason: 'unsupported_repository',
    });
  });

  test('returns an error for a branch that refers to itself', async () => {
    writeFileSync(join(repoDir, '.git/refs/heads/main'), 'ref: refs/heads/main\n');

    // The cause, without isomorphic-git’s request to report the error
    expect(await getLocalGitStatus(createNodeDirectoryHandle(repoDir))).toEqual({
      ready: false,
      reason: 'error',
      detail: 'Circular reference detected while resolving ref "refs/heads/main"',
    });
  });

  test('returns an error', async () => {
    writeFileSync(join(repoDir, '.git/index'), 'Not an index');

    expect(await getLocalGitStatus(createNodeDirectoryHandle(repoDir))).toEqual({
      ready: false,
      reason: 'error',
      detail: 'Invalid index file',
    });
  });
});

describe('formatTimezoneOffset()', () => {
  test('formats an offset like Git', () => {
    expect(formatTimezoneOffset(-540)).toBe('+0900');
    expect(formatTimezoneOffset(0)).toBe('+0000');
    expect(formatTimezoneOffset(210)).toBe('-0330');
  });
});
