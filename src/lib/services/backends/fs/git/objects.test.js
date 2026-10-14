/* eslint-disable no-bitwise */

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { createGitFileSystem } from '$lib/services/backends/fs/git/file-system';
import {
  applyDelta,
  createObjectReader,
  findPackedObject,
  fromHex,
  hashObject,
  inflate,
  parseLooseObject,
  parsePackIndex,
  writeLooseObject,
} from '$lib/services/backends/fs/git/objects';
import { createNodeDirectoryHandle } from '$lib/test/node-fs-handles';

// Auto maintenance is turned off so a detached `git maintenance` doesn’t run alongside the tests
const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'maintenance.auto',
  GIT_CONFIG_VALUE_0: 'false',
  GIT_AUTHOR_NAME: 'Jane Doe',
  GIT_AUTHOR_EMAIL: 'jane@example.com',
  GIT_COMMITTER_NAME: 'Jane Doe',
  GIT_COMMITTER_EMAIL: 'jane@example.com',
};

/**
 * Repository the test repository is copied from, created once, as it takes a while.
 * @type {string}
 */
let templateDir;
/** @type {string} */
let repoDir;
/**
 * Run a Git command in the test repository.
 * @param {string[]} args Arguments.
 * @returns {Buffer} Output.
 */
const gitRaw = (args) => execFileSync('git', args, { cwd: repoDir, env: GIT_ENV, stdio: 'pipe' });
/**
 * Run a Git command in the test repository.
 * @param {...string} args Arguments.
 * @returns {string} Output, trimmed.
 */
const git = (...args) => gitRaw(args).toString().trim();

/**
 * Create a version 2 pack index for the given objects.
 * @param {[string, number][]} objects Object IDs and offsets, sorted by ID.
 * @param {object} [options] Options.
 * @param {boolean} [options.largeOffsets] Whether to store the offsets in the large offset table.
 * @returns {ArrayBuffer} Index.
 */
const createPackIndex = (objects, { largeOffsets = false } = {}) => {
  const count = objects.length;
  const size = 8 + 256 * 4 + count * 28 + (largeOffsets ? count * 8 : 0) + 40;
  const view = new DataView(new ArrayBuffer(size));
  const bytes = new Uint8Array(view.buffer);
  const oidsStart = 8 + 256 * 4;
  const offsetsStart = oidsStart + count * 24;
  const largeOffsetsStart = offsetsStart + count * 4;

  view.setUint32(0, 0xff744f63);
  view.setUint32(4, 2);

  for (let byte = 0; byte < 256; byte += 1) {
    view.setUint32(8 + byte * 4, objects.filter(([oid]) => fromHex(oid)[0] <= byte).length);
  }

  objects.forEach(([oid, offset], index) => {
    bytes.set(fromHex(oid), oidsStart + index * 20);

    if (largeOffsets) {
      view.setUint32(offsetsStart + index * 4, 0x80000000 + index);
      view.setUint32(largeOffsetsStart + index * 8, Math.floor(offset / 2 ** 32));
      view.setUint32(largeOffsetsStart + index * 8 + 4, offset % 2 ** 32);
    } else {
      view.setUint32(offsetsStart + index * 4, offset);
    }
  });

  return view.buffer;
};

/**
 * Write a pack file and its index to the test repository.
 * @param {Uint8Array[]} objects Raw packed objects, including their headers.
 * @param {string[]} oids IDs to list the objects under, in the same order.
 * @returns {number[]} Offsets of the objects.
 */
const writePack = (objects, oids) => {
  const header = Buffer.from('PACK\0\0\0\x02\0\0\0\0', 'latin1');
  /** @type {number[]} */
  const offsets = [];
  let offset = header.length;

  objects.forEach((object) => {
    offsets.push(offset);
    offset += object.length;
  });

  const packDir = join(repoDir, '.git/objects/pack');

  mkdirSync(packDir, { recursive: true });
  writeFileSync(
    join(packDir, 'pack-test.pack'),
    Buffer.concat([header, ...objects, Buffer.alloc(20)]),
  );

  const entries = /** @type {[string, number][]} */ (
    oids.map((oid, index) => [oid, offsets[index]])
  );

  entries.sort(([a], [b]) => a.localeCompare(b));
  writeFileSync(join(packDir, 'pack-test.idx'), Buffer.from(createPackIndex(entries)));

  return offsets;
};

/**
 * Get a reader for the test repository.
 * @returns {ReturnType<typeof createObjectReader>} Reader.
 */
const getReader = () => createObjectReader(createNodeDirectoryHandle(join(repoDir, '.git')));

/**
 * Check that every object in the test repository reads the same as with Git.
 */
const expectAllObjectsReadable = async () => {
  const reader = getReader();
  // Read every object with one command: each comes as `<oid> <type> <size>\n<content>\n`
  const output = gitRaw(['cat-file', '--batch-all-objects', '--batch']);
  /** @type {{ oid: string, type: string, content: Buffer }[]} */
  const objects = [];
  let position = 0;

  while (position < output.length) {
    const headerEnd = output.indexOf(10, position);
    const [oid, type, size] = output.subarray(position, headerEnd).toString().split(' ');
    const contentStart = headerEnd + 1;

    objects.push({
      oid,
      type,
      content: output.subarray(contentStart, contentStart + Number(size)),
    });
    position = contentStart + Number(size) + 1;
  }

  expect(objects.length).toBeGreaterThan(50);

  // eslint-disable-next-line no-restricted-syntax
  for (const { oid, type, content } of objects) {
    // eslint-disable-next-line no-await-in-loop
    const object = await reader.readObject(oid);

    expect(object?.type).toBe(type);
    expect(Buffer.from(/** @type {Uint8Array} */ (object?.content))).toEqual(content);
  }
};

beforeAll(() => {
  templateDir = mkdtempSync(join(tmpdir(), 'sveltia-git-objects-'));
  repoDir = templateDir;
  git('init', '--initial-branch=main');

  // Commit similar content many times, so Git stores most objects as deltas
  for (let index = 0; index < 20; index += 1) {
    mkdirSync(join(repoDir, 'content'), { recursive: true });
    writeFileSync(
      join(repoDir, 'content', `post-${index % 5}.md`),
      `${'Lorem ipsum dolor sit amet. '.repeat(100)}\nRevision ${index}\n`,
    );
    git('add', '.');
    git('commit', '-m', `Revision ${index}\n\n${'Description. '.repeat(30)}`);
  }
});

beforeEach(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'sveltia-git-objects-'));
  cpSync(templateDir, repoDir, { recursive: true });
});

afterEach(() => {
  rmSync(repoDir, { recursive: true, force: true });
});

afterAll(() => {
  rmSync(templateDir, { recursive: true, force: true });
});

describe('createObjectReader()', () => {
  test('reads loose objects', async () => {
    await expectAllObjectsReadable();
  });

  test('reads packed objects stored as offset deltas', async () => {
    git('repack', '-a', '-d', '-f', '--depth=50', '--window=250');
    git('prune-packed');
    expect(git('count-objects')).toMatch(/^0 objects/);

    const packDir = join(repoDir, '.git/objects/pack');

    const indexName = /** @type {string} */ (
      readdirSync(packDir).find((name) => name.endsWith('.idx'))
    );

    // Some objects are deltas of deltas
    expect(git('verify-pack', '-v', join(packDir, indexName))).toMatch(/chain length = 2:/);
    await expectAllObjectsReadable();
  });

  test('reads packed objects stored as reference deltas', async () => {
    git('-c', 'repack.useDeltaBaseOffset=false', 'repack', '-a', '-d', '-f', '--depth=50');
    git('prune-packed');
    await expectAllObjectsReadable();
  });

  test('reads objects from several packs', async () => {
    git('repack', '-d');

    const oid = git('rev-parse', 'HEAD');

    writeFileSync(join(repoDir, 'new.md'), 'New\n');
    git('add', '.');
    git('commit', '-m', 'New');
    git('repack', '-d');
    git('prune-packed');

    const reader = getReader();

    expect((await reader.readObject(oid))?.type).toBe('commit');
    expect((await reader.readObject(git('rev-parse', 'HEAD')))?.type).toBe('commit');
  });

  test('returns `undefined` for an object that doesn’t exist', async () => {
    rmSync(join(repoDir, '.git/objects/pack'), { recursive: true });

    const reader = getReader();

    expect(await reader.readObject('0'.repeat(40))).toBeUndefined();
    expect(await reader.readObject('f'.repeat(40))).toBeUndefined();

    // A pack directory with other files in it
    git('repack', '-a', '-d');
    mkdirSync(join(repoDir, '.git/objects/pack/subdir'));
    writeFileSync(join(repoDir, '.git/objects/pack/pack-x.keep'), '');
    expect(await getReader().readObject('0'.repeat(40))).toBeUndefined();
  });

  test('throws if a loose object can’t be read', async () => {
    const oid = git('rev-parse', 'HEAD');
    const path = join(repoDir, '.git/objects', oid.slice(0, 2), oid.slice(2));

    rmSync(path);
    mkdirSync(path);
    await expect(getReader().readObject(oid)).rejects.toThrow('Not a file');
  });

  test('throws for a delta chain that never ends', async () => {
    // An offset delta whose base is itself
    const oid = 'a'.repeat(40);

    writePack([Uint8Array.of(0x60, 0x00)], [oid]);
    await expect(getReader().readObject(oid)).rejects.toThrow('Delta chain too long');
  });

  test('throws for a reference delta whose base is missing', async () => {
    const oid = 'a'.repeat(40);

    writePack([Uint8Array.of(0x70, ...fromHex('b'.repeat(40)), ...deflateSync(''))], [oid]);
    await expect(getReader().readObject(oid)).rejects.toThrow(
      `Delta base not found: ${'b'.repeat(40)}`,
    );
  });

  test('throws for an object of an invalid type', async () => {
    const oid = 'a'.repeat(40);

    writePack([Uint8Array.of(0x50, ...deflateSync(''))], [oid]);
    await expect(getReader().readObject(oid)).rejects.toThrow('Invalid packed object type: 5');
  });

  test('reads an object whose size takes more than one byte', async () => {
    const oid = 'a'.repeat(40);
    const content = 'x'.repeat(300);

    // Type 3 (blob), size 300: 0b1011_1100 (continued, type, low 4 bits), then 300 >> 4
    writePack([Uint8Array.of(0xbc, 300 >> 4, ...deflateSync(content))], [oid]);
    expect(
      Buffer.from(/** @type {Uint8Array} */ ((await getReader().readObject(oid))?.content)),
    ).toEqual(Buffer.from(content));
  });

  test('reads an offset delta whose distance takes more than one byte', async () => {
    const baseOid = 'a'.repeat(40);
    const oid = 'b'.repeat(40);
    const base = Buffer.from('y'.repeat(200));
    const baseObject = Uint8Array.of(0xb8, 200 >> 4, ...deflateSync(base));
    // A delta copying the whole base: base size and result size (200), then a copy of 200 bytes
    const delta = Uint8Array.of(0xc8, 0x01, 0xc8, 0x01, 0x90, 200);
    // An object that doesn’t compress, to put some distance between the base and the delta
    const padding = Uint8Array.of(0x30, ...deflateSync(randomBytes(200)));
    const distance = baseObject.length + padding.length;

    expect(distance).toBeGreaterThan(127);

    // The distance in 7-bit groups, with one added to every group but the last
    const encodedDistance = Uint8Array.of(0x80 | ((distance >> 7) - 1), distance & 0x7f);

    writePack(
      [
        baseObject,
        padding,
        Uint8Array.of(0x60 | delta.length, ...encodedDistance, ...deflateSync(delta)),
      ],
      [baseOid, 'c'.repeat(40), oid],
    );

    const object = await getReader().readObject(oid);

    expect(object?.type).toBe('blob');
    expect(Buffer.from(/** @type {Uint8Array} */ (object?.content))).toEqual(base);
  });
});

describe('writeLooseObject()', () => {
  test('writes an object Git reads, once', async () => {
    const fs = createGitFileSystem(createNodeDirectoryHandle(repoDir), { Buffer });
    const content = new TextEncoder().encode(`${'A unique blob. '.repeat(100)}\n`);
    const oid = await writeLooseObject(fs, 'blob', content);
    const path = join(repoDir, '.git/objects', oid.slice(0, 2), oid.slice(2));

    expect(oid).toBe(
      execFileSync('git', ['hash-object', '--stdin'], { cwd: repoDir, input: content })
        .toString()
        .trim(),
    );
    expect(gitRaw(['cat-file', 'blob', oid])).toEqual(Buffer.from(content));

    // An existing object isn’t written again
    const { mtimeMs } = statSync(path);

    await writeLooseObject(fs, 'blob', content);
    expect(statSync(path).mtimeMs).toBe(mtimeMs);
  });

  test('writes an object again over an empty file a write cut short left', async () => {
    const fs = createGitFileSystem(createNodeDirectoryHandle(repoDir), { Buffer });
    const content = new TextEncoder().encode('Another unique blob\n');
    const oid = await writeLooseObject(fs, 'blob', content);

    writeFileSync(join(repoDir, '.git/objects', oid.slice(0, 2), oid.slice(2)), '');
    await writeLooseObject(fs, 'blob', content);
    expect(gitRaw(['cat-file', 'blob', oid])).toEqual(Buffer.from(content));
  });

  test('throws if it can’t tell whether the object exists', async () => {
    const fs = createGitFileSystem(createNodeDirectoryHandle(repoDir), { Buffer });
    const error = new Error('EACCES');

    await expect(
      writeLooseObject(
        {
          ...fs,
          /**
           * Fail to get the stats.
           * @throws {Error} Always.
           */
          stat: async () => {
            throw error;
          },
        },
        'blob',
        new Uint8Array(),
      ),
    ).rejects.toBe(error);
  });
});

describe('hashObject()', () => {
  test('calculates the same ID as Git', async () => {
    writeFileSync(join(repoDir, 'hello.txt'), 'Hello\n');
    expect(await hashObject('blob', new TextEncoder().encode('Hello\n'))).toBe(
      git('hash-object', 'hello.txt'),
    );
  });
});

describe('fromHex()', () => {
  test('converts hexadecimal to bytes', () => {
    expect([...fromHex('000fff')]).toEqual([0, 15, 255]);
    expect([...fromHex('')]).toEqual([]);
  });
});

describe('inflate()', () => {
  test('decompresses zlib data', async () => {
    expect(new TextDecoder().decode(await inflate(deflateSync('Hello')))).toBe('Hello');
  });
});

describe('parseLooseObject()', () => {
  const encoder = new TextEncoder();

  test('parses an object', () => {
    const { type, content } = parseLooseObject(encoder.encode('blob 5\0Hello'));

    expect(type).toBe('blob');
    expect(new TextDecoder().decode(content)).toBe('Hello');
  });

  test('throws for an invalid type', () => {
    expect(() => parseLooseObject(encoder.encode('file 5\0Hello'))).toThrow(
      'Invalid object type: file',
    );
  });

  test('throws for a wrong size', () => {
    expect(() => parseLooseObject(encoder.encode('blob 6\0Hello'))).toThrow('Object size mismatch');
  });
});

describe('applyDelta()', () => {
  const base = new TextEncoder().encode('Hello, world');

  test('copies from the base and inserts new data', () => {
    // Base size 12, result size 12: copy 7 bytes from offset 0, then insert “there”
    const delta = Uint8Array.of(12, 12, 0x90, 7, 5, ...new TextEncoder().encode('there'));

    expect(new TextDecoder().decode(applyDelta(base, delta))).toBe('Hello, there');
  });

  test('copies 64 KiB when the size is zero', () => {
    const largeBase = new Uint8Array(0x10000).fill(7);
    // Base and result sizes of 65,536 in 7-bit groups, then a copy with no size bytes
    const delta = Uint8Array.of(0x80, 0x80, 0x04, 0x80, 0x80, 0x04, 0x80);

    expect(applyDelta(largeBase, delta)).toEqual(largeBase);
  });

  test('uses every byte of the offset and size', () => {
    // Copy 3 bytes from offset 1, given as four offset bytes and three size bytes
    const delta = Uint8Array.of(12, 3, 0xff, 1, 0, 0, 0, 3, 0, 0);

    expect(new TextDecoder().decode(applyDelta(base, delta))).toBe('ell');
  });

  test('throws for a base of a different size', () => {
    expect(() => applyDelta(base, Uint8Array.of(11, 0))).toThrow('Delta base size mismatch');
  });

  test('throws for an invalid instruction', () => {
    expect(() => applyDelta(base, Uint8Array.of(12, 1, 0))).toThrow('Invalid delta instruction');
  });

  test('throws for a result of a different size', () => {
    expect(() => applyDelta(base, Uint8Array.of(12, 2, 0x90, 1))).toThrow(
      'Delta result size mismatch',
    );
  });
});

describe('parsePackIndex() and findPackedObject()', () => {
  test('find the offset of an object', () => {
    const index = parsePackIndex(
      createPackIndex([
        ['00'.repeat(20), 12],
        [`80${'00'.repeat(19)}`, 34],
        ['ff'.repeat(20), 56],
      ]),
    );

    expect(findPackedObject(index, fromHex('00'.repeat(20)))).toBe(12);
    expect(findPackedObject(index, fromHex(`80${'00'.repeat(19)}`))).toBe(34);
    expect(findPackedObject(index, fromHex('ff'.repeat(20)))).toBe(56);
    expect(findPackedObject(index, fromHex(`80${'00'.repeat(18)}01`))).toBeUndefined();
    expect(findPackedObject(index, fromHex(`7f${'00'.repeat(19)}`))).toBeUndefined();
  });

  test('read the offsets beyond 2 GiB', () => {
    const oid = 'ab'.repeat(20);
    const index = parsePackIndex(createPackIndex([[oid, 5 * 2 ** 32 + 7]], { largeOffsets: true }));

    expect(findPackedObject(index, fromHex(oid))).toBe(5 * 2 ** 32 + 7);
  });

  test('throw for an index of an unsupported version', () => {
    const buffer = createPackIndex([]);

    new DataView(buffer).setUint32(4, 1);
    expect(() => parsePackIndex(buffer)).toThrow('Unsupported pack index version');
    expect(() => parsePackIndex(new ArrayBuffer(8 + 256 * 4))).toThrow(
      'Unsupported pack index version',
    );
  });
});
