import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAdditions } from '$lib/services/additions/api';
import {
  addComment,
  additionsComments,
  deleteComment,
  deleteEntryComments,
  editComment,
  fetchComments,
  loadCommentCounts,
  moveEntryComments,
  startComments,
} from '$lib/services/additions/comments.svelte';
import { onSocketMessage } from '$lib/services/additions/socket.svelte';
import { user } from '$lib/services/user/account.svelte';

vi.mock('$lib/services/additions/api', () => ({ fetchAdditions: vi.fn() }));
vi.mock('$lib/services/additions/socket.svelte', () => ({ onSocketMessage: vi.fn() }));
vi.mock('$lib/services/user/account.svelte', () => ({ user: { account: undefined } }));

const COMMENT = {
  id: 'c1',
  key: 'posts/hello',
  body: 'Hi',
  author: { id: 'u1', name: 'Ada', username: 'ada', image: null },
  created_at: '2026-10-15T00:00:00Z',
  updated_at: '2026-10-15T00:01:00Z',
  can_edit: true,
  can_delete: true,
};

beforeEach(() => {
  user.account = /** @type {any} */ ({ login: 'ada', refreshToken: 'session' });
  Object.assign(additionsComments, { counts: {}, versions: {} });
});

describe('fetchComments', () => {
  test('turns comments into conversation items, and counts them', async () => {
    vi.mocked(fetchAdditions).mockResolvedValue({
      comments: [COMMENT, { ...COMMENT, id: 'c2', author: null, can_edit: false }],
      has_more: false,
    });

    const { items, hasMore } = await fetchComments('posts/hello');

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/comments?key=posts%2Fhello', {
      method: undefined,
      body: undefined,
      token: 'session',
    });
    expect(hasMore).toBe(false);
    expect(items[0]).toEqual({
      id: 'c1',
      body: 'Hi',
      author: { name: 'Ada', login: 'ada', isSelf: true },
      createdDate: new Date('2026-10-15T00:00:00Z'),
      updatedDate: new Date('2026-10-15T00:01:00Z'),
      canEdit: true,
      canDelete: true,
    });
    expect(items[1].author).toBeNull();
    expect(additionsComments.counts['posts/hello']).toBe(2);
  });

  test('leaves the count alone when older comments are left out', async () => {
    vi.mocked(fetchAdditions).mockResolvedValue({
      comments: [COMMENT],
      has_more: true,
    });

    await fetchComments('posts/hello');
    expect(additionsComments.counts['posts/hello']).toBeUndefined();
  });

  test('fetches the page before a comment, which doesn’t tell the count either', async () => {
    vi.mocked(fetchAdditions).mockResolvedValue({ comments: [COMMENT], has_more: false });

    await fetchComments('posts/hello', { before: 'c 9' });
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/comments?key=posts%2Fhello&before=c%209', {
      method: undefined,
      body: undefined,
      token: 'session',
    });
    expect(additionsComments.counts['posts/hello']).toBeUndefined();
  });

  test('doesn’t count comments that arrive after signing out', async () => {
    const stop = startComments();
    const { promise, resolve } = Promise.withResolvers();

    vi.mocked(fetchAdditions).mockReturnValueOnce(promise);

    const loading = fetchComments('posts/hello');

    stop();
    resolve({ comments: [COMMENT], has_more: false });
    await loading;
    expect(additionsComments.counts).toEqual({});
  });
});

describe('writes', () => {
  test('add, edit and delete comments', async () => {
    vi.mocked(fetchAdditions).mockResolvedValue({ comment: COMMENT });

    await expect(addComment('posts/hello', 'Hi')).resolves.toMatchObject({ id: 'c1' });
    expect(fetchAdditions).toHaveBeenLastCalledWith('/v1/comments', {
      method: 'POST',
      body: { key: 'posts/hello', body: 'Hi' },
      token: 'session',
    });

    await expect(editComment('c/1', 'Edited')).resolves.toMatchObject({ id: 'c1' });
    expect(fetchAdditions).toHaveBeenLastCalledWith('/v1/comments/c%2F1', {
      method: 'PATCH',
      body: { body: 'Edited' },
      token: 'session',
    });

    await deleteComment('c1');
    expect(fetchAdditions).toHaveBeenLastCalledWith('/v1/comments/c1', {
      method: 'DELETE',
      body: undefined,
      token: 'session',
    });
  });

  test('move and delete an entry’s comments unless it’s known to have none, ignoring failures', async () => {
    const stop = startComments();

    // The counts haven’t loaded, e.g. as the socket couldn’t connect: the request is sent anyway
    vi.mocked(fetchAdditions).mockResolvedValue({});
    await moveEntryComments('posts/a', 'posts/b');
    expect(fetchAdditions).toHaveBeenLastCalledWith('/v1/comments/rename', {
      method: 'POST',
      body: { from: 'posts/a', to: 'posts/b' },
      token: 'session',
    });

    // Once they have, an entry without comments is left alone
    vi.mocked(fetchAdditions).mockResolvedValueOnce({ counts: { 'posts/a': 2 } });
    await loadCommentCounts();
    vi.mocked(fetchAdditions).mockClear();
    await moveEntryComments('posts/c', 'posts/d');
    await deleteEntryComments('posts/c');
    await moveEntryComments('posts/a', 'posts/a');
    expect(fetchAdditions).not.toHaveBeenCalled();

    vi.mocked(fetchAdditions).mockRejectedValue(new Error('Unreachable'));
    await expect(moveEntryComments('posts/a', 'posts/b')).resolves.toBeUndefined();
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/comments/rename', {
      method: 'POST',
      body: { from: 'posts/a', to: 'posts/b' },
      token: 'session',
    });
    await expect(deleteEntryComments('posts/a')).resolves.toBeUndefined();
    expect(fetchAdditions).toHaveBeenLastCalledWith('/v1/comments?key=posts%2Fa', {
      method: 'DELETE',
      body: undefined,
      token: 'session',
    });
    stop();
  });
});

describe('counts and notices', () => {
  test('load the counts, keeping them on failure', async () => {
    vi.mocked(fetchAdditions).mockResolvedValueOnce({ counts: { 'posts/a': 3 } });
    await loadCommentCounts();
    expect(additionsComments.counts).toEqual({ 'posts/a': 3 });

    vi.mocked(fetchAdditions).mockRejectedValueOnce(new Error('Unreachable'));
    await loadCommentCounts();
    expect(additionsComments.counts).toEqual({ 'posts/a': 3 });
  });

  test('follow the socket while signed in with Sveltia CMS Additions', () => {
    const stop = startComments();
    const handlers = Object.fromEntries(vi.mocked(onSocketMessage).mock.calls);

    handlers.comments({ type: 'comments', key: 'posts/a', count: 4 });
    handlers.comments({ type: 'comments', key: 'posts/a', count: 5 });
    expect(additionsComments).toEqual({
      counts: { 'posts/a': 5 },
      versions: { 'posts/a': 2 },
    });

    vi.mocked(fetchAdditions).mockResolvedValueOnce({ counts: {} });
    handlers.connected({ type: 'connected' });
    expect(fetchAdditions).toHaveBeenCalledWith('/v1/comments/counts', {
      method: undefined,
      body: undefined,
      token: 'session',
    });

    // Signing out forgets them
    stop?.();
    expect(additionsComments).toEqual({ counts: {}, versions: {} });
  });

  test('aren’t brought back by counts that arrive after signing out', async () => {
    const stop = startComments();
    /**
     * Send the response of the pending request.
     * @type {(value: any) => void}
     */
    let respond = () => {};

    vi.mocked(fetchAdditions).mockReturnValueOnce(
      new Promise((resolve) => {
        respond = resolve;
      }),
    );

    const loading = loadCommentCounts();

    stop?.();
    respond({ counts: { 'posts/a': 3 } });
    await loading;
    expect(additionsComments.counts).toEqual({});
  });
});
