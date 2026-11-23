import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchAdditions } from '$lib/services/additions/api';
import {
  acquireLock,
  closeEntry,
  entryLocks,
  getDraftLockKey,
  getLockKey,
  getLockNotice,
  getOtherReaders,
  getOthersLock,
  getOtherViewers,
  openEntry,
  releaseLock,
  startLocks,
  takeOverLock,
  watchEntry,
} from '$lib/services/additions/locks.svelte';
import {
  connectSocket,
  disconnectSocket,
  onSocketMessage,
  RECONNECT_DELAYS,
  socketState,
  startSocket,
} from '$lib/services/additions/socket.svelte';
import { user } from '$lib/services/user/account.svelte';

vi.mock('@sveltia/i18n', async (importOriginal) => ({
  ...(await importOriginal()),
  locale: { current: 'en-US' },
}));
vi.mock('$lib/services/additions/api', () => ({ fetchAdditions: vi.fn() }));
vi.mock('$lib/services/app/additions', () => ({
  getAdditionsURL: vi.fn(() => 'https://additions.example'),
}));
vi.mock('$lib/services/backends/git/github/repository', () => ({
  repository: { branch: 'main' },
}));
vi.mock('$lib/services/user/account.svelte', () => ({ user: { account: undefined } }));

/**
 * A WebSocket stand-in that records what is sent and lets a test play the service.
 */
class FakeWebSocket extends EventTarget {
  static OPEN = 1;

  /** @type {FakeWebSocket[]} */
  static instances = [];

  /**
   * Create a socket.
   * @param {string} url URL.
   */
  constructor(url) {
    super();
    this.url = url;
    this.readyState = FakeWebSocket.OPEN;
    /** @type {any[]} */
    this.sent = [];
    this.close = vi.fn(() => {
      this.readyState = 3;
      this.dispatchEvent(new Event('close'));
    });
    FakeWebSocket.instances.push(this);
  }

  /**
   * Record a message.
   * @param {string} data Message.
   */
  send(data) {
    this.sent.push(JSON.parse(data));
  }

  /**
   * Receive a message from the service.
   * @param {any} message Message, or a string to send as is.
   */
  receive(message) {
    this.dispatchEvent(
      new MessageEvent('message', {
        data: typeof message === 'string' ? message : JSON.stringify(message),
      }),
    );
  }
}

const ADA_LOCK = {
  key: 'posts/hello@main',
  user_id: 'u1',
  name: 'Ada',
  since: '2026-10-13T00:00:00.000Z',
  connection: 'c1',
};

const BOB_LOCK = { ...ADA_LOCK, user_id: 'u2', name: 'Bob', connection: 'c2' };

/**
 * Connect, and answer with a snapshot.
 * @param {any[]} [locks] Locks in the snapshot.
 * @returns {Promise<FakeWebSocket>} Socket.
 */
const connectWithSnapshot = async (locks = []) => {
  await connectSocket();

  const ws = /** @type {FakeWebSocket} */ (FakeWebSocket.instances.at(-1));

  ws.receive({ type: 'snapshot', connection: 'c1', user_id: 'u1', locks });

  return ws;
};

/** @type {() => void} */
let stopLocks;

/**
 * Sign out: stop sharing the locks and disconnect, as the session does.
 */
const signOut = () => {
  stopLocks();
  disconnectSocket();
};

beforeEach(() => {
  stopLocks = startLocks();
  vi.stubGlobal('WebSocket', FakeWebSocket);
  FakeWebSocket.instances = [];
  user.account = /** @type {any} */ ({ backendName: 'github', refreshToken: 'session' });
  vi.mocked(fetchAdditions).mockResolvedValue({ ticket: 'a b' });
});

afterEach(() => {
  signOut();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('lock keys', () => {
  test('name the entry or file, and the branch', () => {
    expect(getLockKey('posts', 'hello')).toBe('posts/hello@main');
    expect(
      getDraftLockKey(
        /** @type {any} */ ({ collectionName: 'posts', originalEntry: { subPath: 'a' } }),
      ),
    ).toBe('posts/a@main');
    expect(
      getDraftLockKey(
        /** @type {any} */ ({ collectionName: 'pages', fileName: 'about', originalEntry: {} }),
      ),
    ).toBe('pages/about@main');
  });

  test('aren’t given to new entries, array items and missing drafts', () => {
    expect(getDraftLockKey(undefined)).toBeUndefined();
    expect(getDraftLockKey(/** @type {any} */ ({ isNew: true, collectionName: 'posts' }))).toBe(
      undefined,
    );
    expect(
      getDraftLockKey(
        /** @type {any} */ ({
          collectionName: 'posts',
          originalEntry: { subPath: 'a', arrayIndex: 0 },
        }),
      ),
    ).toBeUndefined();
    expect(getDraftLockKey(/** @type {any} */ ({ collectionName: 'pages' }))).toBeUndefined();
  });
});

describe('connectSocket', () => {
  test('opens a WebSocket with a ticket, and keeps the snapshot', async () => {
    const ws = await connectWithSnapshot([BOB_LOCK]);

    expect(fetchAdditions).toHaveBeenCalledWith('/v1/socket/ticket', {
      method: 'POST',
      token: 'session',
    });
    expect(ws.url).toBe('wss://additions.example/v1/socket?ticket=a%20b');
    expect(socketState.status).toBe('connected');
    expect(entryLocks).toMatchObject({
      connection: 'c1',
      userId: 'u1',
      locks: { 'posts/hello@main': BOB_LOCK },
    });

    // Already connected
    await connectSocket();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  test('connects for the next sign-in while the previous ticket is still on its way', async () => {
    /** @type {PromiseWithResolvers<any>} */
    const stale = Promise.withResolvers();

    vi.mocked(fetchAdditions).mockReturnValueOnce(stale.promise);

    const previous = connectSocket();

    // Signed out, and someone signed in again before the ticket came
    signOut();
    stopLocks = startLocks();
    await connectSocket();
    expect(FakeWebSocket.instances).toHaveLength(1);

    // The previous ticket arriving late changes nothing
    stale.resolve({ ticket: 'old' });
    await previous;
    expect(FakeWebSocket.instances).toHaveLength(1);
    await connectSocket();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  test('doesn’t connect after signing out while the ticket was on its way', async () => {
    vi.useFakeTimers();

    /** @type {PromiseWithResolvers<any>} */
    const ticket = Promise.withResolvers();

    vi.mocked(fetchAdditions).mockReturnValueOnce(ticket.promise);

    const connecting = connectSocket();

    // Only one connection is opened at a time
    await connectSocket();
    expect(fetchAdditions).toHaveBeenCalledOnce();

    signOut();
    ticket.resolve({ ticket: 't' });
    await connecting;
    expect(FakeWebSocket.instances).toHaveLength(0);

    // A failure then doesn’t schedule a reconnection either
    /** @type {PromiseWithResolvers<any>} */
    const failing = Promise.withResolvers();

    vi.mocked(fetchAdditions).mockReturnValueOnce(failing.promise);

    const failed = connectSocket();

    signOut();
    failing.reject(new Error('Unreachable'));
    await failed;
    await vi.runAllTimersAsync();
    expect(socketState.status).toBe('disconnected');
    expect(fetchAdditions).toHaveBeenCalledTimes(2);
  });

  test('needs a session', async () => {
    user.account = undefined;
    await connectSocket();
    expect(fetchAdditions).not.toHaveBeenCalled();
  });

  test('ignores a message it can’t read', async () => {
    const ws = await connectWithSnapshot();

    ws.receive('not json');
    ws.receive({ type: 'error', code: 'invalid_message' });
    expect(socketState.status).toBe('connected');
  });

  test('reconnects with backoff, then takes back the locks it held', async () => {
    vi.useFakeTimers();

    const ws = await connectWithSnapshot();

    acquireLock('posts/hello@main');
    expect(ws.sent).toEqual([{ type: 'acquire', key: 'posts/hello@main' }]);

    // The service is deployed, then can’t be reached for a moment
    vi.mocked(fetchAdditions).mockRejectedValueOnce(new Error('Unreachable'));
    ws.close();
    expect(socketState.status).toBe('unavailable');
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS[0]);
    expect(FakeWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAYS[1]);
    expect(FakeWebSocket.instances).toHaveLength(2);

    const next = /** @type {FakeWebSocket} */ (FakeWebSocket.instances[1]);

    next.receive({ type: 'snapshot', connection: 'c3', user_id: 'u1', locks: [] });
    expect(next.sent).toEqual([{ type: 'acquire', key: 'posts/hello@main' }]);
  });

  test('keeps trying at the longest delay', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchAdditions).mockRejectedValue(new Error('Unreachable'));

    await connectSocket();

    const total = RECONNECT_DELAYS.reduce((sum, delay) => sum + delay, 0);

    await vi.advanceTimersByTimeAsync(total + /** @type {number} */ (RECONNECT_DELAYS.at(-1)));
    expect(fetchAdditions).toHaveBeenCalledTimes(RECONNECT_DELAYS.length + 2);
  });
});

describe('onSocketMessage', () => {
  test('passes other messages on, and says when the socket connects', async () => {
    const comments = vi.fn();
    const connected = vi.fn();

    onSocketMessage('comments', comments);
    onSocketMessage('connected', connected);

    const ws = await connectWithSnapshot();

    expect(connected).toHaveBeenCalledWith({ type: 'connected' });
    ws.receive({ type: 'comments', key: 'posts/hello', count: 2 });
    expect(comments).toHaveBeenCalledWith({ type: 'comments', key: 'posts/hello', count: 2 });
  });
});

describe('locks', () => {
  test('are acquired, refused, taken over and released', async () => {
    const ws = await connectWithSnapshot();

    acquireLock('posts/hello@main');
    ws.receive({ type: 'refused', key: 'posts/hello@main', reason: 'held', lock: BOB_LOCK });
    expect(getOthersLock('posts/hello@main')).toEqual(BOB_LOCK);
    expect(getLockNotice('posts/hello@main')).toEqual({ type: 'held', lock: BOB_LOCK });

    // A refusal without a lock, e.g. for a viewer, changes nothing
    ws.receive({ type: 'refused', key: 'posts/other@main', reason: 'forbidden' });
    expect(entryLocks.locks['posts/other@main']).toBeUndefined();

    takeOverLock('posts/hello@main');
    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: ADA_LOCK });
    expect(getOthersLock('posts/hello@main')).toBeUndefined();
    expect(getLockNotice('posts/hello@main')).toBeUndefined();
    // An entry that can’t be locked, e.g. a new one, has no key
    expect(getOthersLock(undefined)).toBeUndefined();

    releaseLock('posts/hello@main');
    expect(ws.sent.at(-1)).toEqual({ type: 'release', key: 'posts/hello@main' });
    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: null });
    expect(entryLocks.locks).toEqual({});

    // Not held: nothing to send
    releaseLock('posts/hello@main');
    expect(ws.sent).toHaveLength(3);
  });

  test('tell the editor when someone takes over, and take the lock back once released', async () => {
    const ws = await connectWithSnapshot();

    acquireLock('posts/hello@main');
    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: ADA_LOCK });
    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: BOB_LOCK });

    expect(getLockNotice('posts/hello@main')).toEqual({ type: 'taken_over', lock: BOB_LOCK });

    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: null });
    expect(ws.sent.at(-1)).toEqual({ type: 'acquire', key: 'posts/hello@main' });
    expect(getLockNotice('posts/hello@main')).toBeUndefined();
  });

  test('are acquired once released by whoever was editing when the entry was opened', async () => {
    const ws = await connectWithSnapshot([BOB_LOCK]);

    acquireLock('posts/hello@main');
    ws.receive({ type: 'refused', key: 'posts/hello@main', reason: 'held', lock: BOB_LOCK });
    expect(getLockNotice('posts/hello@main')).toEqual({ type: 'held', lock: BOB_LOCK });

    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: null });
    // Asked for again, rather than editing without it
    expect(ws.sent).toEqual([
      { type: 'acquire', key: 'posts/hello@main' },
      { type: 'acquire', key: 'posts/hello@main' },
    ]);
    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: ADA_LOCK });
    expect(getLockNotice('posts/hello@main')).toBeUndefined();

    // Another entry, not open here, is left alone
    ws.receive({ type: 'changed', key: 'posts/other@main', lock: BOB_LOCK });
    ws.receive({ type: 'changed', key: 'posts/other@main', lock: null });
    expect(ws.sent.filter(({ key }) => key === 'posts/other@main')).toEqual([]);
  });

  test('are let go when given after the editor was closed', async () => {
    const ws = await connectWithSnapshot();

    acquireLock('posts/hello@main');
    releaseLock('posts/hello@main');
    // Nothing to release yet
    expect(ws.sent).toEqual([{ type: 'acquire', key: 'posts/hello@main' }]);

    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: ADA_LOCK });
    expect(ws.sent.at(-1)).toEqual({ type: 'release', key: 'posts/hello@main' });

    // A lock this tab still wants is kept
    acquireLock('posts/other@main');
    ws.receive({
      type: 'changed',
      key: 'posts/other@main',
      lock: { ...ADA_LOCK, key: 'posts/other@main' },
    });
    expect(ws.sent.at(-1)).toEqual({ type: 'acquire', key: 'posts/other@main' });
  });

  test('stay this tab’s after a reconnection the service hasn’t noticed yet', async () => {
    const ws = await connectWithSnapshot();

    acquireLock('posts/hello@main');
    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: ADA_LOCK });
    ws.close();
    await connectSocket();

    const next = /** @type {FakeWebSocket} */ (FakeWebSocket.instances.at(-1));

    // Still kept for the previous connection, which would refuse asking for it
    next.receive({ type: 'snapshot', connection: 'c3', user_id: 'u1', locks: [ADA_LOCK] });
    expect(next.sent).toEqual([{ type: 'takeover', key: 'posts/hello@main' }]);
    expect(getLockNotice('posts/hello@main')).toBeUndefined();
  });

  test('are taken back from an earlier connection when the entry is opened again', async () => {
    const ws = await connectWithSnapshot();

    acquireLock('posts/hello@main');
    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: ADA_LOCK });
    ws.close();
    // Closed while disconnected: there was no way to let it go
    releaseLock('posts/hello@main');
    await connectSocket();

    const next = /** @type {FakeWebSocket} */ (FakeWebSocket.instances.at(-1));

    next.receive({ type: 'snapshot', connection: 'c3', user_id: 'u1', locks: [ADA_LOCK] });
    expect(next.sent).toEqual([]);

    acquireLock('posts/hello@main');
    expect(next.sent).toEqual([{ type: 'takeover', key: 'posts/hello@main' }]);
  });

  test('are asked for again when let go after being taken over while disconnected', async () => {
    const ws = await connectWithSnapshot();

    acquireLock('posts/hello@main');
    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: ADA_LOCK });
    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: BOB_LOCK });
    ws.close();
    await connectSocket();

    const next = /** @type {FakeWebSocket} */ (FakeWebSocket.instances.at(-1));

    // Bob closed the entry meanwhile
    next.receive({ type: 'snapshot', connection: 'c3', user_id: 'u1', locks: [] });
    expect(next.sent).toEqual([{ type: 'acquire', key: 'posts/hello@main' }]);
    expect(entryLocks.takenOver).toEqual({});
    expect(getLockNotice('posts/hello@main')).toBeUndefined();
  });

  test('aren’t asked for again while whoever took them over still holds them', async () => {
    const ws = await connectWithSnapshot();

    acquireLock('posts/hello@main');
    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: ADA_LOCK });
    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: BOB_LOCK });
    ws.close();
    await connectSocket();

    const next = /** @type {FakeWebSocket} */ (FakeWebSocket.instances.at(-1));

    next.receive({ type: 'snapshot', connection: 'c3', user_id: 'u1', locks: [BOB_LOCK] });
    expect(next.sent).toEqual([]);
    expect(getLockNotice('posts/hello@main')).toEqual({ type: 'taken_over', lock: BOB_LOCK });
  });

  test('say others could be editing when refused for another reason', async () => {
    const ws = await connectWithSnapshot();

    acquireLock('posts/hello@main');
    ws.receive({ type: 'refused', key: 'posts/hello@main', reason: 'too_many_locks' });
    expect(getLockNotice('posts/hello@main')).toEqual({ type: 'unavailable' });

    // Until it’s asked for again
    acquireLock('posts/hello@main');
    expect(getLockNotice('posts/hello@main')).toBeUndefined();
  });

  test('are held while an entry is watched by someone who can edit it', async () => {
    const ws = await connectWithSnapshot();
    const stop = watchEntry('posts/hello@main', { hold: true });

    ws.receive({ type: 'changed', key: 'posts/hello@main', lock: ADA_LOCK });
    stop();
    expect(ws.sent).toEqual([
      { type: 'open', key: 'posts/hello@main' },
      { type: 'acquire', key: 'posts/hello@main' },
      { type: 'release', key: 'posts/hello@main' },
      { type: 'close', key: 'posts/hello@main' },
    ]);

    // Someone who can’t edit it only says it’s open
    ws.sent = [];
    watchEntry('posts/other@main', { hold: false })();
    expect(ws.sent).toEqual([
      { type: 'open', key: 'posts/other@main' },
      { type: 'close', key: 'posts/other@main' },
    ]);
  });

  test('tell apart the user’s own other tab, and say when locks are unavailable', async () => {
    const ws = await connectWithSnapshot([{ ...ADA_LOCK, connection: 'other-tab' }]);

    expect(getLockNotice('posts/hello@main')).toMatchObject({ type: 'yours' });
    expect(getLockNotice(undefined)).toBeUndefined();

    ws.close();
    expect(getLockNotice('posts/new@main')).toEqual({ type: 'unavailable' });
  });

  test('aren’t sent while disconnected', () => {
    acquireLock('posts/hello@main');
    expect(FakeWebSocket.instances).toHaveLength(0);
  });
});

describe('startLocks', () => {
  test('follows the lock messages, and forgets the locks once stopped', async () => {
    await connectWithSnapshot([BOB_LOCK]);
    expect(getOthersLock('posts/hello@main')).toEqual(BOB_LOCK);

    stopLocks();
    expect(entryLocks.locks).toEqual({});
  });
});

describe('startSocket', () => {
  test('connects, and returns the way to disconnect', async () => {
    const stop = startSocket();

    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    stop();
    expect(FakeWebSocket.instances[0].close).toHaveBeenCalledWith(1000);
    expect(socketState.status).toBe('disconnected');
  });
});

describe('presence', () => {
  /**
   * Someone with an entry open.
   * @param {string} connection Connection.
   * @param {string} userId User ID.
   * @param {string} name Name.
   * @returns {any} Viewer.
   */
  const viewer = (connection, userId, name) => ({ connection, user_id: userId, name });

  test('says what’s open here, again after a reconnection, until it’s closed', async () => {
    const ws = await connectWithSnapshot();

    openEntry('posts/a@main');
    expect(ws.sent.at(-1)).toEqual({ type: 'open', key: 'posts/a@main' });

    // The service forgot it with the connection
    ws.receive({ type: 'snapshot', connection: 'c2', user_id: 'u1', locks: [] });
    expect(ws.sent.at(-1)).toEqual({ type: 'open', key: 'posts/a@main' });

    closeEntry('posts/a@main');
    expect(ws.sent.at(-1)).toEqual({ type: 'close', key: 'posts/a@main' });

    const count = ws.sent.length;

    ws.receive({ type: 'snapshot', connection: 'c3', user_id: 'u1', locks: [] });
    expect(ws.sent).toHaveLength(count);
  });

  test('follows who has an entry open, leaving out the user', async () => {
    const ws = await connectWithSnapshot();

    ws.receive({
      type: 'snapshot',
      connection: 'c1',
      user_id: 'u1',
      locks: [],
      presence: { 'posts/a@main': [viewer('c9', 'u9', 'Zoe')] },
    });
    expect(getOtherViewers('posts/a@main')).toEqual([{ id: 'u9', name: 'Zoe' }]);

    ws.receive({
      type: 'presence',
      key: 'posts/a@main',
      viewers: [
        viewer('c1', 'u1', 'Me'),
        viewer('c2', 'u1', 'Me'),
        viewer('c3', 'u2', 'Ada Lovelace'),
        viewer('c4', 'u2', 'Ada Lovelace'),
        viewer('c5', 'u3', 'Bob'),
      ],
    });
    // Once each, even in several tabs
    expect(getOtherViewers('posts/a@main')).toEqual([
      { id: 'u2', name: 'Ada Lovelace' },
      { id: 'u3', name: 'Bob' },
    ]);
    expect(getOtherViewers('posts/b@main')).toEqual([]);
    expect(getOtherViewers(undefined)).toEqual([]);

    // Whoever is editing the entry is shown with the lock instead
    ws.receive({
      type: 'changed',
      key: 'posts/a@main',
      lock: {
        key: 'posts/a@main',
        user_id: 'u2',
        name: 'Ada Lovelace',
        since: '',
        connection: 'c3',
      },
    });
    expect(getOtherReaders('posts/a@main')).toEqual([{ id: 'u3', name: 'Bob' }]);

    ws.receive({ type: 'presence', key: 'posts/a@main', viewers: [] });
    expect(entryLocks.presence).toEqual({});

    signOut();
    expect(entryLocks.presence).toEqual({});
  });
});
