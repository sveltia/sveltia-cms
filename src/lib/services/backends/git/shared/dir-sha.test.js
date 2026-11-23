import { describe, expect, test, vi } from 'vitest';

import { createCachedDirSHALookup } from '$lib/services/backends/git/shared/dir-sha';

const COMMIT = 'a'.repeat(40);

/**
 * Create a cached lookup over a mock.
 * @returns {{ repository: any, lookUp: any, fetchDirSHA: any, resetDirLookups: any }} Lookup.
 */
const setup = () => {
  const repository = /** @type {any} */ ({ owner: 'owner', repo: 'repo' });
  const lookUp = vi.fn(async (ref, dirPath) => `${ref}:${dirPath}`);

  return { repository, lookUp, ...createCachedDirSHALookup(repository, lookUp) };
};

describe('createCachedDirSHALookup', () => {
  test('looks a directory up at a commit only once', async () => {
    const { lookUp, fetchDirSHA } = setup();

    await expect(fetchDirSHA(COMMIT, 'site')).resolves.toBe(`${COMMIT}:site`);
    await expect(fetchDirSHA(COMMIT, 'site')).resolves.toBe(`${COMMIT}:site`);
    expect(lookUp).toHaveBeenCalledExactlyOnceWith(COMMIT, 'site');
  });

  test('keeps a directory that doesn’t exist as well', async () => {
    const { lookUp, fetchDirSHA } = setup();

    lookUp.mockResolvedValue(undefined);
    await fetchDirSHA(COMMIT, 'missing');
    await expect(fetchDirSHA(COMMIT, 'missing')).resolves.toBeUndefined();
    expect(lookUp).toHaveBeenCalledOnce();
  });

  test('looks a directory up on a branch every time, as the branch moves', async () => {
    const { lookUp, fetchDirSHA } = setup();

    await fetchDirSHA('main', 'site');
    await fetchDirSHA('main', 'site');
    expect(lookUp).toHaveBeenCalledTimes(2);
  });

  test('looks a directory up again in another repository', async () => {
    const { repository, lookUp, fetchDirSHA } = setup();

    await fetchDirSHA(COMMIT, 'site');
    repository.repo = 'other';
    await fetchDirSHA(COMMIT, 'site');
    expect(lookUp).toHaveBeenCalledTimes(2);
  });

  test('keeps the lookups of both heads a check for remote changes makes at once', async () => {
    const { lookUp, fetchDirSHA } = setup();
    const [from, to] = ['a'.repeat(40), 'b'.repeat(40)];

    await Promise.all([fetchDirSHA(from, 'site'), fetchDirSHA(to, 'site')]);
    await fetchDirSHA(from, 'site');
    await fetchDirSHA(to, 'site');
    expect(lookUp).toHaveBeenCalledTimes(2);
  });

  test('keeps only the most recent lookups', async () => {
    const { lookUp, fetchDirSHA } = setup();

    // One more commit than are kept, one at a time
    // eslint-disable-next-line no-restricted-syntax
    for (const char of ['a', 'b', 'c', 'd', 'e']) {
      // eslint-disable-next-line no-await-in-loop
      await fetchDirSHA(char.repeat(40), 'site');
    }

    await fetchDirSHA('e'.repeat(40), 'site');
    expect(lookUp).toHaveBeenCalledTimes(5);
    await fetchDirSHA('a'.repeat(40), 'site');
    expect(lookUp).toHaveBeenCalledTimes(6);
  });

  test('forgets the lookups when reset', async () => {
    const { lookUp, fetchDirSHA, resetDirLookups } = setup();

    await fetchDirSHA(COMMIT, 'site');
    resetDirLookups();
    await fetchDirSHA(COMMIT, 'site');
    expect(lookUp).toHaveBeenCalledTimes(2);
  });
});
