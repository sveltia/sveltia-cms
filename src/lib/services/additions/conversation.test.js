import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  addComment,
  additionsComments,
  deleteComment,
  editComment,
  fetchComments,
  moveEntryComments,
} from '$lib/services/additions/comments.svelte';
import { getConversationAliasKeys } from '$lib/services/additions/conversation-aliases';
import {
  conversations,
  getConversationCount,
  loadConversation,
  loadOlderComments,
  moveEntryConversation,
  removeComment,
  sendComment,
  startConversations,
  updateComment,
} from '$lib/services/additions/conversation.svelte';

vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key) }));
vi.mock('$lib/services/additions/conversation-aliases', () => ({
  getConversationAliasKeys: vi.fn(() => []),
}));
vi.mock('$lib/services/additions/comments.svelte', () => ({
  additionsComments: { counts: {}, versions: {} },
  addComment: vi.fn(),
  deleteComment: vi.fn(),
  editComment: vi.fn(),
  fetchComments: vi.fn(),
  moveEntryComments: vi.fn(),
}));

const KEY = 'posts/hello';
const DRAFT = /** @type {any} */ ({ collectionName: 'posts', originalEntry: { subPath: 'hello' } });

/**
 * Create a comment.
 * @param {string} id ID.
 * @param {string} date Creation date.
 * @returns {any} Comment.
 */
const createItem = (id, date) => ({
  id,
  body: id,
  author: null,
  createdDate: new Date(date),
  updatedDate: new Date(date),
  canEdit: true,
  canDelete: true,
});

beforeEach(() => {
  Object.assign(conversations, { entries: {}, drafts: {} });
  additionsComments.counts = {};
});

describe('getConversationCount', () => {
  test('counts the comments kept by the service', () => {
    expect(getConversationCount(DRAFT)).toBe(0);
    additionsComments.counts = { [KEY]: 3 };
    expect(getConversationCount(DRAFT)).toBe(3);
    expect(getConversationCount(undefined)).toBe(0);

    // Along with those kept under the entry’s earlier keys
    additionsComments.counts = { [KEY]: 3, 'posts/old': 2 };
    vi.mocked(getConversationAliasKeys).mockReturnValueOnce(['posts/old', 'posts/gone']);
    expect(getConversationCount(DRAFT)).toBe(5);
  });
});

describe('loadConversation', () => {
  test('loads the comments, keeping those loaded before when it fails', async () => {
    vi.mocked(fetchComments).mockResolvedValue({
      items: [createItem('c1', '2026-10-13T00:00:00Z')],
      hasMore: true,
    });

    await loadConversation(KEY);
    expect(conversations.entries[KEY]).toMatchObject({
      loading: false,
      loaded: true,
      error: '',
      hasMore: true,
    });

    vi.mocked(fetchComments).mockRejectedValue(
      new Error('Forbidden', { cause: { message: 'Not allowed' } }),
    );
    await loadConversation(KEY);
    expect(conversations.entries[KEY]).toMatchObject({ error: 'Not allowed', loading: false });
    expect(conversations.entries[KEY].comments).toHaveLength(1);

    vi.mocked(fetchComments).mockRejectedValue(new Error('Network'));
    await loadConversation(KEY);
    expect(conversations.entries[KEY].error).toBe('additions.error.unexpected');

    // A later success clears the error
    vi.mocked(fetchComments).mockResolvedValue({ items: [], hasMore: false });
    await loadConversation(KEY);
    expect(conversations.entries[KEY]).toMatchObject({ error: '', comments: [] });
  });
});

describe('loadConversation with earlier keys', () => {
  test('shows the comments kept under them along with the entry’s own, oldest first', async () => {
    vi.mocked(fetchComments).mockImplementation(async (key) =>
      key === KEY
        ? { items: [createItem('c2', '2026-10-14T00:00:00Z')], hasMore: true }
        : { items: [createItem('c1', '2026-10-13T00:00:00Z')], hasMore: false },
    );

    await loadConversation(KEY, ['posts/old']);
    expect(fetchComments).toHaveBeenCalledWith('posts/old');
    expect(conversations.entries[KEY].comments.map(({ id }) => id)).toEqual(['c1', 'c2']);
    // Older ones are loaded from the entry’s own oldest comment
    expect(conversations.entries[KEY].oldestId).toBe('c2');
    // Older comments are only loaded under the entry’s own key
    expect(conversations.entries[KEY].hasMore).toBe(true);
  });
});

describe('loads and changes in flight', () => {
  test('show the comments of the latest load only', async () => {
    const first = Promise.withResolvers();
    const second = Promise.withResolvers();

    vi.mocked(fetchComments)
      .mockReturnValueOnce(/** @type {any} */ (first.promise))
      .mockReturnValueOnce(/** @type {any} */ (second.promise));

    const loads = [loadConversation(KEY), loadConversation(KEY)];

    second.resolve({ items: [createItem('c2', '2026-10-15T00:00:00Z')], hasMore: false });
    await loads[1];
    // The older load comes back last, with a comment deleted since
    first.resolve({ items: [createItem('c1', '2026-10-14T00:00:00Z')], hasMore: false });
    await loads[0];
    expect(conversations.entries[KEY].comments.map(({ id }) => id)).toEqual(['c2']);
    expect(conversations.entries[KEY].loading).toBe(false);
  });

  test('don’t undo a change made while loading', async () => {
    const load = Promise.withResolvers();

    vi.mocked(fetchComments).mockReturnValueOnce(/** @type {any} */ (load.promise));
    conversations.entries[KEY] = /** @type {any} */ ({
      comments: [createItem('c1', '2026-10-14T00:00:00Z')],
    });

    const loading = loadConversation(KEY);

    await removeComment(KEY, 'c1');
    // Sent before the comment was deleted
    load.resolve({ items: [createItem('c1', '2026-10-14T00:00:00Z')], hasMore: false });
    await loading;
    expect(conversations.entries[KEY]).toMatchObject({
      comments: [],
      loading: false,
      loaded: true,
    });
  });

  test('keep what has been typed while a comment is being sent', async () => {
    const sending = Promise.withResolvers();

    vi.mocked(addComment).mockReturnValueOnce(/** @type {any} */ (sending.promise));
    conversations.drafts[KEY] = 'First';

    const sent = sendComment(KEY);

    conversations.drafts[KEY] = 'Second';
    sending.resolve(createItem('c1', '2026-10-15T00:00:00Z'));
    await sent;
    expect(conversations.drafts[KEY]).toBe('Second');
  });

  test('aren’t brought back once signed out', async () => {
    const stop = startConversations();
    const load = Promise.withResolvers();
    const sending = Promise.withResolvers();
    const editing = Promise.withResolvers();
    const deleting = Promise.withResolvers();

    vi.mocked(fetchComments).mockReturnValueOnce(/** @type {any} */ (load.promise));
    vi.mocked(addComment).mockReturnValueOnce(/** @type {any} */ (sending.promise));
    vi.mocked(editComment).mockReturnValueOnce(/** @type {any} */ (editing.promise));
    vi.mocked(deleteComment).mockReturnValueOnce(/** @type {any} */ (deleting.promise));
    conversations.drafts[KEY] = 'Hello';

    const requests = [
      loadConversation(KEY),
      sendComment(KEY),
      updateComment(KEY, 'c1', 'Edited'),
      removeComment(KEY, 'c1'),
    ];

    stop();
    load.resolve({ items: [createItem('c1', '2026-10-14T00:00:00Z')], hasMore: false });
    sending.resolve(createItem('c2', '2026-10-15T00:00:00Z'));
    editing.resolve(createItem('c1', '2026-10-14T00:00:00Z'));
    deleting.resolve(undefined);
    await Promise.all(requests);
    expect(conversations).toEqual({ entries: {}, drafts: {} });
  });
});

describe('loadOlderComments', () => {
  test('adds the older comments among those shown', async () => {
    conversations.entries[KEY] = /** @type {any} */ ({
      comments: [
        // Kept under an earlier key, and older than the entry’s own
        createItem('c0', '2026-10-01T00:00:00Z'),
        createItem('c2', '2026-10-14T00:00:00Z'),
        createItem('c3', '2026-10-15T00:00:00Z'),
      ],
      hasMore: true,
      oldestId: 'c2',
    });
    vi.mocked(fetchComments).mockResolvedValueOnce({
      // One of them is shown already, e.g. as it was added meanwhile
      items: [createItem('c1', '2026-10-13T00:00:00Z'), createItem('c2', '2026-10-14T00:00:00Z')],
      hasMore: false,
    });

    await loadOlderComments(KEY);
    // From the entry’s own oldest comment
    expect(fetchComments).toHaveBeenCalledWith(KEY, { before: 'c2' });
    expect(conversations.entries[KEY]).toMatchObject({ hasMore: false, oldestId: 'c1' });
    expect(conversations.entries[KEY].comments.map(({ id }) => id)).toEqual([
      'c0',
      'c1',
      'c2',
      'c3',
    ]);

    // Nothing older came back
    vi.mocked(fetchComments).mockResolvedValueOnce({ items: [], hasMore: false });
    await loadOlderComments(KEY);
    expect(conversations.entries[KEY].oldestId).toBe('c1');
  });

  test('does nothing without comments, or once signed out', async () => {
    await loadOlderComments(KEY);
    expect(fetchComments).not.toHaveBeenCalled();

    const stop = startConversations();
    const load = Promise.withResolvers();

    conversations.entries[KEY] = /** @type {any} */ ({
      comments: [createItem('c2', '2026-10-14T00:00:00Z')],
      oldestId: 'c2',
    });
    vi.mocked(fetchComments).mockReturnValueOnce(/** @type {any} */ (load.promise));

    const loading = loadOlderComments(KEY);

    stop();
    load.resolve({ items: [createItem('c1', '2026-10-13T00:00:00Z')], hasMore: false });
    await loading;
    expect(conversations.entries).toEqual({});
  });
});

describe('moveEntryConversation', () => {
  test('moves the comment being written along with the comments', async () => {
    conversations.drafts['posts/old'] = 'Half-written';

    await moveEntryConversation('posts/old', 'posts/new');
    expect(conversations.drafts).toEqual({ 'posts/new': 'Half-written' });
    expect(moveEntryComments).toHaveBeenCalledWith('posts/old', 'posts/new');

    // Nothing to move, or no move at all
    await moveEntryConversation('posts/other', 'posts/new');
    conversations.drafts['posts/new'] = 'Kept';
    await moveEntryConversation('posts/new', 'posts/new');
    expect(conversations.drafts).toEqual({ 'posts/new': 'Kept' });
  });
});

describe('writes', () => {
  test('send the draft, then edit and delete the comment', async () => {
    vi.mocked(addComment).mockResolvedValue(createItem('c1', '2026-10-15T00:00:00Z'));

    // Nothing to send
    await sendComment(KEY);
    conversations.drafts[KEY] = '   ';
    await sendComment(KEY);
    expect(addComment).not.toHaveBeenCalled();

    conversations.drafts[KEY] = 'Hello';
    await sendComment(KEY);
    expect(addComment).toHaveBeenCalledWith(KEY, 'Hello');
    expect(conversations.drafts[KEY]).toBe('');
    expect(conversations.entries[KEY].comments.map(({ id }) => id)).toEqual(['c1']);

    vi.mocked(editComment).mockResolvedValue({
      ...createItem('c1', '2026-10-15T00:00:00Z'),
      body: 'Edited',
    });
    conversations.entries[KEY].comments.push(createItem('c2', '2026-10-15T01:00:00Z'));
    await updateComment(KEY, 'c1', 'Edited');
    expect(editComment).toHaveBeenCalledWith('c1', 'Edited');
    expect(conversations.entries[KEY].comments.map(({ body }) => body)).toEqual(['Edited', 'c2']);

    await removeComment(KEY, 'c1');
    expect(deleteComment).toHaveBeenCalledWith('c1');
    expect(conversations.entries[KEY].comments.map(({ id }) => id)).toEqual(['c2']);
  });
});

describe('startConversations', () => {
  test('forgets the comments loaded and the ones being written, once signed out', () => {
    const stop = startConversations();

    conversations.entries['posts/hello'] = /** @type {any} */ ({ loaded: true, comments: [{}] });
    conversations.drafts['posts/hello'] = 'Half-written';

    stop();
    expect(conversations).toEqual({ entries: {}, drafts: {} });
  });
});
