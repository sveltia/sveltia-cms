/* eslint-disable jsdoc/require-jsdoc */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  createFileSystemError,
  createGitFileSystem,
  splitPath,
} from '$lib/services/backends/fs/git/file-system';
import { createNodeDirectoryHandle } from '$lib/test/node-fs-handles';

/** @type {string} */
let rootDir;
/** @type {ReturnType<typeof createGitFileSystem>} */
let fs;

beforeEach(() => {
  rootDir = mkdtempSync(join(tmpdir(), 'sveltia-git-fs-'));
  mkdirSync(join(rootDir, 'dir/sub'), { recursive: true });
  writeFileSync(join(rootDir, 'dir/file.txt'), 'Hello');
  fs = createGitFileSystem(createNodeDirectoryHandle(rootDir), { Buffer });
});

afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true });
});

/**
 * Create a file system whose files can’t be written.
 * @returns {{ fs: ReturnType<typeof createGitFileSystem>, abort: import('vitest').Mock }} File
 * system and the mock `abort()` method of its writable streams.
 */
const createFailingFileSystem = () => {
  // The stream is unusable once the write has failed, so aborting it fails as well
  const abort = vi.fn(async () => {
    throw new Error('Stream closed');
  });

  const fileHandle = {
    kind: 'file',
    getFile: async () => new File(['Hello'], 'file.txt'),
    createWritable: async () => ({
      write: async () => {
        throw new Error('Disk full');
      },
      close: vi.fn(),
      abort,
    }),
  };

  const rootDirHandle = /** @type {any} */ ({
    kind: 'directory',
    getFileHandle: async () => fileHandle,
  });

  return { fs: createGitFileSystem(rootDirHandle, { Buffer }), abort };
};

describe('splitPath()', () => {
  test('splits a path into segments', () => {
    expect(splitPath('/a//b/./c/')).toEqual(['a', 'b', 'c']);
    expect(splitPath('/')).toEqual([]);
  });
});

describe('createFileSystemError()', () => {
  test('creates an error with a code', () => {
    const error = createFileSystemError('ENOENT', 'a/b');

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('ENOENT: a/b');
    expect(error.code).toBe('ENOENT');
    expect(error.path).toBe('a/b');
  });
});

describe('createGitFileSystem()', () => {
  test('reads a file as a buffer or text', async () => {
    const buffer = await fs.readFile('/dir/file.txt');

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toBe('Hello');
    expect(await fs.readFile('/dir/file.txt', 'utf8')).toBe('Hello');
    expect(await fs.readFile('/dir/file.txt', { encoding: 'utf8' })).toBe('Hello');
  });

  test('rejects reading a missing file or a directory', async () => {
    await expect(fs.readFile('/dir/missing.txt')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.readFile('/missing/file.txt')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.readFile('/dir/file.txt/x')).rejects.toMatchObject({ code: 'ENOTDIR' });
    await expect(fs.readFile('/dir')).rejects.toMatchObject({ code: 'EISDIR' });
    await expect(fs.readFile('/')).rejects.toMatchObject({ code: 'EISDIR' });
  });

  test('passes an error without a Node equivalent through', async () => {
    // The File System API rejects a name like `..` with a `TypeError`
    await expect(fs.readFile('/dir/../file.txt')).rejects.toThrow(TypeError);
  });

  test('writes a file', async () => {
    await fs.writeFile('/dir/new.txt', 'New');
    await fs.writeFile('/dir/file.txt', Buffer.from('Updated'));
    expect(readFileSync(join(rootDir, 'dir/new.txt'), 'utf8')).toBe('New');
    expect(readFileSync(join(rootDir, 'dir/file.txt'), 'utf8')).toBe('Updated');
    await expect(fs.writeFile('/missing/new.txt', 'New')).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  test('aborts a failed write, leaving the file as it was', async () => {
    const { fs: failingFs, abort } = createFailingFileSystem();

    await expect(failingFs.writeFile('/file.txt', 'New')).rejects.toThrow('Disk full');
    expect(abort).toHaveBeenCalled();
  });

  test('rejects writing in a browser that can’t write files', async () => {
    const rootDirHandle = /** @type {any} */ ({
      kind: 'directory',
      getFileHandle: async () => ({
        kind: 'file',
        getFile: async () => new File([], 'a.txt'),
      }),
    });

    const legacyFs = createGitFileSystem(rootDirHandle, { Buffer });

    await expect(legacyFs.writeFile('/a.txt', 'New')).rejects.toMatchObject({ code: 'ENOTSUP' });
    await expect(legacyFs.appendFile('/a.txt', 'New')).rejects.toMatchObject({ code: 'ENOTSUP' });
  });

  test('appends to a file', async () => {
    await fs.appendFile('/dir/file.txt', ', world');
    await fs.appendFile('/dir/log.txt', 'First');
    expect(readFileSync(join(rootDir, 'dir/file.txt'), 'utf8')).toBe('Hello, world');
    expect(readFileSync(join(rootDir, 'dir/log.txt'), 'utf8')).toBe('First');
  });

  test('aborts a failed append', async () => {
    const { fs: failingFs, abort } = createFailingFileSystem();

    await expect(failingFs.appendFile('/file.txt', 'New')).rejects.toThrow('Disk full');
    expect(abort).toHaveBeenCalled();
  });

  test('creates a directory', async () => {
    await fs.mkdir('/dir/new');
    // An existing directory is fine
    await fs.mkdir('/dir/new');
    expect(existsSync(join(rootDir, 'dir/new'))).toBe(true);
    await expect(fs.mkdir('/missing/new')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(fs.mkdir('/dir/file.txt')).rejects.toMatchObject({ code: 'ENOTDIR' });
  });

  test('removes an empty directory', async () => {
    await expect(fs.rmdir('/dir')).rejects.toMatchObject({ code: 'ENOTEMPTY' });
    await expect(fs.rmdir('/dir/file.txt')).rejects.toMatchObject({ code: 'ENOTDIR' });
    await fs.rmdir('/dir/sub');
    expect(existsSync(join(rootDir, 'dir/sub'))).toBe(false);
    await expect(fs.rmdir('/dir/sub')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('removes a file', async () => {
    await expect(fs.unlink('/dir/sub')).rejects.toMatchObject({ code: 'ENOTDIR' });
    await fs.unlink('/dir/file.txt');
    expect(existsSync(join(rootDir, 'dir/file.txt'))).toBe(false);
    await expect(fs.unlink('/dir/file.txt')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('lists a directory', async () => {
    expect((await fs.readdir('/dir')).sort()).toEqual(['file.txt', 'sub']);
    expect(await fs.readdir('/')).toEqual(['dir']);
    await expect(fs.readdir('/dir/file.txt')).rejects.toMatchObject({ code: 'ENOTDIR' });
    await expect(fs.readdir('/missing')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('gets the stats of a file or directory', async () => {
    const fileStats = await fs.stat('/dir/file.txt');
    const dirStats = await fs.lstat('/dir');

    expect(fileStats).toMatchObject({ mode: 0o100644, size: 5, ino: 0, uid: 0, gid: 0, dev: 0 });
    expect(fileStats.mtimeMs).toBeGreaterThan(0);
    expect(fileStats.ctimeMs).toBe(fileStats.mtimeMs);
    expect(fileStats.isFile()).toBe(true);
    expect(fileStats.isDirectory()).toBe(false);
    expect(fileStats.isSymbolicLink()).toBe(false);
    expect(dirStats).toMatchObject({ mode: 0o40000, size: 0, mtimeMs: 0 });
    expect(dirStats.isFile()).toBe(false);
    expect(dirStats.isDirectory()).toBe(true);
    await expect(fs.stat('/dir/missing')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('doesn’t support symbolic links', async () => {
    await expect(fs.readlink('/dir/file.txt')).rejects.toMatchObject({ code: 'ENOTSUP' });
    await expect(fs.symlink('/dir/file.txt', '/dir/link')).rejects.toMatchObject({
      code: 'ENOTSUP',
    });
  });
});
