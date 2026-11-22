import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { createGitDataCommit, RATE_LIMIT_DELAYS } from '$lib/services/backends/git/github/git-data';
import { fetchAPI } from '$lib/services/backends/git/shared/api';

vi.mock('$lib/services/backends/git/shared/api', () => ({ fetchAPI: vi.fn() }));
vi.mock('$lib/services/utils/file', () => ({
  getGitHash: vi.fn(async (data) => `hash-of-${typeof data === 'string' ? data : 'blob'}`),
}));

const AUTHOR = { mode: /** @type {const} */ ('user'), name: 'Ed', email: 'ed@example.com' };
const IMAGE = new Blob(['image']);

/**
 * Arguments of a commit with a text file, an image and a deletion.
 * @returns {any} Arguments.
 */
const createArgs = () => ({
  owner: 'acme',
  repo: 'site',
  branch: 'cms/posts/a b',
  expectedHeadOid: 'head-sha',
  additions: [
    { index: 0, path: 'content/a.md', contents: 'QQ==', data: 'A' },
    { index: 1, path: 'images/a.jpg', contents: 'aW1hZ2U=', data: IMAGE },
    { index: 2, path: 'content/empty.md', contents: '', data: undefined },
    { index: 3, path: 'content/moved.md', contents: 'TQ==', data: 'M' },
  ],
  deletions: [{ path: 'content/b.md' }, { path: 'content/moved.md' }],
  message: 'Update posts',
  author: AUTHOR,
});

/**
 * A rate limit error, as `fetchAPI` throws it.
 * @param {number} status Status.
 * @param {string} [message] Message.
 * @returns {Error} Error.
 */
const createError = (status, message = 'You have exceeded a secondary rate limit') =>
  new Error('Server responded with an error', { cause: { status, message } });

/**
 * Make the mocked API answer like GitHub, with the given blob responses in turn.
 * @param {(() => any)[]} [blobResponses] Responses to the blob requests.
 */
const respond = (blobResponses = []) => {
  vi.mocked(fetchAPI).mockImplementation(async (path, { method = 'GET' } = {}) => {
    if (path.endsWith('/commits/head-sha')) {
      return { sha: 'head-sha', tree: { sha: 'base-tree' } };
    }

    if (path.endsWith('/blobs')) {
      return (blobResponses.shift() ?? (() => ({ sha: 'image-sha' })))();
    }

    if (path.endsWith('/trees')) {
      return { sha: 'new-tree' };
    }

    if (path.endsWith('/commits') && method === 'POST') {
      return { sha: 'new-sha', committer: { date: '2026-10-13T00:00:00Z' } };
    }

    return { ref: 'refs/heads/x' };
  });
};

describe('createGitDataCommit', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-13T00:00:00Z') });
    respond();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('commits as the person, with text inline and a blob for each binary file', async () => {
    await expect(createGitDataCommit(createArgs())).resolves.toEqual({
      oid: 'new-sha',
      committedDate: '2026-10-13T00:00:00Z',
      file_0: { oid: 'hash-of-A' },
      file_1: { oid: 'hash-of-blob' },
      file_2: { oid: 'hash-of-' },
      file_3: { oid: 'hash-of-M' },
    });

    expect(fetchAPI).toHaveBeenCalledWith('/repos/acme/site/git/blobs', {
      method: 'POST',
      body: { content: 'aW1hZ2U=', encoding: 'base64' },
    });
    expect(vi.mocked(fetchAPI).mock.calls.filter(([path]) => path.endsWith('/blobs'))).toHaveLength(
      1,
    );
    expect(fetchAPI).toHaveBeenCalledWith('/repos/acme/site/git/trees', {
      method: 'POST',
      body: {
        base_tree: 'base-tree',
        tree: [
          { path: 'content/a.md', mode: '100644', type: 'blob', content: 'A' },
          { path: 'images/a.jpg', mode: '100644', type: 'blob', sha: 'image-sha' },
          { path: 'content/empty.md', mode: '100644', type: 'blob', content: '' },
          { path: 'content/moved.md', mode: '100644', type: 'blob', content: 'M' },
          // A file deleted and added again is left to the addition
          { path: 'content/b.md', mode: '100644', type: 'blob', sha: null },
        ],
      },
    });

    const signature = { name: 'Ed', email: 'ed@example.com', date: '2026-10-13T00:00:00.000Z' };

    expect(fetchAPI).toHaveBeenCalledWith('/repos/acme/site/git/commits', {
      method: 'POST',
      body: {
        message: 'Update posts',
        tree: 'new-tree',
        parents: ['head-sha'],
        author: signature,
        committer: signature,
      },
    });
    expect(fetchAPI).toHaveBeenLastCalledWith('/repos/acme/site/git/refs/heads/cms/posts/a%20b', {
      method: 'PATCH',
      body: { sha: 'new-sha', force: false },
    });
  });

  test('waits and tries again when the secondary rate limit refuses a blob', async () => {
    respond([
      () => {
        throw createError(403);
      },
      () => {
        throw createError(429, undefined);
      },
    ]);

    const promise = createGitDataCommit(createArgs());

    await vi.advanceTimersByTimeAsync(RATE_LIMIT_DELAYS[0] + RATE_LIMIT_DELAYS[1]);
    await expect(promise).resolves.toMatchObject({ oid: 'new-sha' });
    expect(vi.mocked(fetchAPI).mock.calls.filter(([path]) => path.endsWith('/blobs'))).toHaveLength(
      3,
    );
  });

  test('gives up after the last retry, and on any other error straight away', async () => {
    respond(RATE_LIMIT_DELAYS.concat(0).map(() => () => Promise.reject(createError(429))));

    const promise = createGitDataCommit(createArgs());
    const assertion = expect(promise).rejects.toMatchObject({ cause: { status: 429 } });

    await vi.runAllTimersAsync();
    await assertion;

    vi.mocked(fetchAPI).mockClear();
    respond([() => Promise.reject(createError(403, 'Resource not accessible by integration'))]);

    await expect(createGitDataCommit(createArgs())).rejects.toMatchObject({
      cause: { status: 403 },
    });
    expect(vi.mocked(fetchAPI).mock.calls.filter(([path]) => path.endsWith('/blobs'))).toHaveLength(
      1,
    );
  });

  test('passes on a refused branch update', async () => {
    const refused = createError(422, 'Update is not a fast forward');

    vi.mocked(fetchAPI).mockImplementation(async (path, { method = 'GET' } = {}) => {
      if (method === 'PATCH') {
        throw refused;
      }

      if (path.endsWith('/commits/head-sha')) {
        return { tree: { sha: 'base-tree' } };
      }

      return path.endsWith('/commits')
        ? { sha: 'new-sha', committer: { date: '2026-10-13T00:00:00Z' } }
        : { sha: 'some-sha' };
    });

    await expect(createGitDataCommit(createArgs())).rejects.toBe(refused);
  });

  test('handles a rate limit error without a cause', async () => {
    respond([() => Promise.reject(new Error('Network'))]);

    await expect(createGitDataCommit(createArgs())).rejects.toThrow('Network');
  });
});
