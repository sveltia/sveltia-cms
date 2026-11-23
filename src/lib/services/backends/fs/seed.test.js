// @vitest-environment happy-dom

/* eslint-disable no-console */

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  fetchSeedFile,
  fetchSeedManifest,
  getSeedManifestURL,
  isDemoSite,
  isValidSeedPath,
  seedTestRepository,
  writeSeedFile,
} from '$lib/services/backends/fs/seed';
import { getFileHandle } from '$lib/services/backends/fs/shared/handles';
import { writeFile } from '$lib/services/backends/fs/shared/save';

/**
 * @import { Mock } from 'vitest';
 */

vi.mock('$lib/services/backends/fs/shared/handles', () => ({
  getFileHandle: vi.fn(async (_dir, path) => ({ path })),
}));

vi.mock('$lib/services/backends/fs/shared/save', () => ({
  writeFile: vi.fn(),
}));

const MANIFEST_URL = 'https://demo.example.com/seed/manifest.json';

/**
 * Add a `<link rel="cms-seed-url">` element to the page.
 * @param {string} href Link URL.
 */
const addSeedLink = (href) => {
  const link = document.createElement('link');

  link.rel = 'cms-seed-url';
  link.href = href;
  document.head.append(link);
};

/**
 * Create a mock `fetch` serving the given files.
 * @param {Record<string, any>} files Response body keyed by URL. An object is served as JSON.
 * @returns {Mock} Mock.
 */
const mockFetch = (files) =>
  vi.fn(async (/** @type {string | URL} */ url) => {
    const body = files[String(url)];

    if (body === undefined) {
      return new Response(null, { status: 404 });
    }

    return typeof body === 'string' ? new Response(body) : Response.json(body);
  });

/**
 * Create a mock OPFS root directory.
 * @param {object} [options] Options.
 * @param {boolean} [options.exists] Whether the repository directory already exists.
 * @returns {any} Mock handle.
 */
const createStorageDir = ({ exists = false } = {}) => {
  const repoDir = { name: 'repo' };

  return {
    repoDir,
    getDirectoryHandle: vi.fn(async (_name, { create = false } = {}) => {
      if (!exists && !create) {
        throw new DOMException('Not found', 'NotFoundError');
      }

      return repoDir;
    }),
  };
};

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  document.head.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getSeedManifestURL()', () => {
  test('returns the absolute URL of the link', () => {
    addSeedLink('/seed/manifest.json');

    expect(getSeedManifestURL()).toBe(new URL('/seed/manifest.json', window.location.href).href);
  });

  test('returns undefined without a link', () => {
    expect(getSeedManifestURL()).toBeUndefined();
  });

  test('returns undefined for a link without `href`', () => {
    const link = document.createElement('link');

    link.rel = 'cms-seed-url';
    document.head.append(link);

    expect(getSeedManifestURL()).toBeUndefined();
  });
});

describe('isDemoSite()', () => {
  test('returns true for the test backend with a seed manifest', () => {
    addSeedLink(MANIFEST_URL);

    expect(isDemoSite('test-repo')).toBe(true);
  });

  test('returns false for another backend', () => {
    addSeedLink(MANIFEST_URL);

    expect(isDemoSite('github')).toBe(false);
    expect(isDemoSite(undefined)).toBe(false);
  });

  test('returns false without a seed manifest', () => {
    expect(isDemoSite('test-repo')).toBe(false);
  });
});

describe('isValidSeedPath()', () => {
  test.each(['a.md', 'content/posts/a.md', 'static/images/a b#c.jpg'])('accepts %j', (path) => {
    expect(isValidSeedPath(path)).toBe(true);
  });

  test.each(['', '/a.md', 'a/', 'a//b.md', './a.md', 'a/../../b.md', '..', 1, null, undefined, {}])(
    'rejects %j',
    (path) => {
      expect(isValidSeedPath(path)).toBe(false);
    },
  );
});

describe('fetchSeedManifest()', () => {
  test('returns the valid paths and warns about the others', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        [MANIFEST_URL]: { files: ['content/a.md', '../b.md', 3, 'images/c.jpg', 'content/a.md'] },
      }),
    );

    await expect(fetchSeedManifest(MANIFEST_URL)).resolves.toEqual([
      'content/a.md',
      'images/c.jpg',
    ]);
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith(
      'Skipping an invalid path in the seed manifest: "../b.md"',
    );
  });

  test('throws if the manifest is not found', async () => {
    vi.stubGlobal('fetch', mockFetch({}));

    await expect(fetchSeedManifest(MANIFEST_URL)).rejects.toThrow(
      'Failed to fetch the seed manifest: 404',
    );
  });

  test('throws if `files` is not an array', async () => {
    vi.stubGlobal('fetch', mockFetch({ [MANIFEST_URL]: { files: 'a.md' } }));

    await expect(fetchSeedManifest(MANIFEST_URL)).rejects.toThrow(
      'The seed manifest must have a `files` array',
    );
  });
});

describe('fetchSeedFile()', () => {
  test('fetches the file relative to the manifest', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ 'https://demo.example.com/seed/static/a%20b%23c.jpg': 'image' }),
    );

    const blob = await fetchSeedFile(MANIFEST_URL, 'static/a b#c.jpg');

    expect(await blob?.text()).toBe('image');
  });

  test('warns if the file is not found', async () => {
    vi.stubGlobal('fetch', mockFetch({}));

    await expect(fetchSeedFile(MANIFEST_URL, 'a.md')).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('Failed to seed a.md:', new Error('HTTP 404'));
  });
});

describe('writeSeedFile()', () => {
  const repoDir = /** @type {any} */ ({});
  const blob = new Blob(['A']);

  test('writes the file', async () => {
    await writeSeedFile(repoDir, 'content/a.md', blob);

    expect(getFileHandle).toHaveBeenCalledWith(repoDir, 'content/a.md');
    expect(writeFile).toHaveBeenCalledWith({ path: 'content/a.md' }, blob);
  });

  test('warns if the file cannot be written', async () => {
    const error = new Error('Quota exceeded');

    vi.mocked(writeFile).mockRejectedValueOnce(error);
    await writeSeedFile(repoDir, 'a.md', blob);

    expect(console.warn).toHaveBeenCalledWith('Failed to seed a.md:', error);
  });
});

describe('seedTestRepository()', () => {
  test('does nothing without a link', async () => {
    const storageDir = createStorageDir();
    const fetch = vi.fn();

    vi.stubGlobal('fetch', fetch);
    await seedTestRepository(storageDir, 'repo');

    expect(storageDir.getDirectoryHandle).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  test('leaves an existing repository untouched', async () => {
    const storageDir = createStorageDir({ exists: true });
    const fetch = vi.fn();

    addSeedLink(MANIFEST_URL);
    vi.stubGlobal('fetch', fetch);
    await seedTestRepository(storageDir, 'repo');

    expect(storageDir.getDirectoryHandle).toHaveBeenCalledExactlyOnceWith('repo');
    expect(fetch).not.toHaveBeenCalled();
  });

  test('writes every file in the manifest to a new repository', async () => {
    const storageDir = createStorageDir();

    addSeedLink(MANIFEST_URL);
    vi.stubGlobal(
      'fetch',
      mockFetch({
        [MANIFEST_URL]: { files: ['content/a.md', 'static/b.jpg'] },
        'https://demo.example.com/seed/content/a.md': 'A',
        'https://demo.example.com/seed/static/b.jpg': 'B',
      }),
    );
    await seedTestRepository(storageDir, 'repo');

    expect(storageDir.getDirectoryHandle).toHaveBeenLastCalledWith('repo', { create: true });
    expect(vi.mocked(getFileHandle).mock.calls).toEqual([
      [storageDir.repoDir, 'content/a.md'],
      [storageDir.repoDir, 'static/b.jpg'],
    ]);
    expect(writeFile).toHaveBeenCalledTimes(2);
  });

  test('skips the files that cannot be downloaded', async () => {
    const storageDir = createStorageDir();

    addSeedLink(MANIFEST_URL);
    vi.stubGlobal(
      'fetch',
      mockFetch({
        [MANIFEST_URL]: { files: ['content/a.md', 'missing.md'] },
        'https://demo.example.com/seed/content/a.md': 'A',
      }),
    );
    await seedTestRepository(storageDir, 'repo');

    expect(vi.mocked(getFileHandle).mock.calls).toEqual([[storageDir.repoDir, 'content/a.md']]);
  });

  test('does not create the repository if no file can be downloaded', async () => {
    const storageDir = createStorageDir();

    addSeedLink(MANIFEST_URL);
    vi.stubGlobal('fetch', mockFetch({ [MANIFEST_URL]: { files: ['missing.md'] } }));
    await seedTestRepository(storageDir, 'repo');

    expect(storageDir.getDirectoryHandle).toHaveBeenCalledExactlyOnceWith('repo');
    expect(writeFile).not.toHaveBeenCalled();
  });

  test('warns without creating the repository if the manifest cannot be fetched', async () => {
    const storageDir = createStorageDir();

    addSeedLink(MANIFEST_URL);
    vi.stubGlobal('fetch', mockFetch({}));
    await seedTestRepository(storageDir, 'repo');

    expect(storageDir.getDirectoryHandle).toHaveBeenCalledExactlyOnceWith('repo');
    expect(console.warn).toHaveBeenCalledWith(
      'Failed to seed the test repository:',
      new Error('Failed to fetch the seed manifest: 404'),
    );
  });
});
