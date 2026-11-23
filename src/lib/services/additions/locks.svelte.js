import {
  onSocketMessage,
  sendSocketMessage,
  socketState,
} from '$lib/services/additions/socket.svelte';
import { repository } from '$lib/services/backends/git/github/repository';
import { getDraftEntryKey, getEntryKey } from '$lib/services/contents/entry/entry-key';

/**
 * @import { EntryDraft } from '$lib/types/private';
 */

/**
 * An entry lock, as Sveltia CMS Additions reports it.
 * @typedef {object} EntryLock
 * @property {string} key Lock key.
 * @property {string} user_id ID of the user who holds it.
 * @property {string} name Name of the user who holds it.
 * @property {string} since When it was acquired, as ISO 8601.
 * @property {string} connection Connection, i.e. CMS tab, that holds it.
 */

/**
 * Someone with an entry open in the editor, read-only or not, as Sveltia CMS Additions reports it.
 * @typedef {object} EntryViewer
 * @property {string} connection Connection, i.e. CMS tab.
 * @property {string} user_id User ID.
 * @property {string} name User’s name.
 */

/**
 * State of the locks, shared over the socket. Locks are advisory: GitHub still refuses a save that
 * conflicts with someone else’s, so editing goes on when the service can’t be reached.
 */
export const entryLocks = $state({
  /** ID of this tab’s connection. */
  connection: '',
  /** ID of the signed-in user. */
  userId: '',
  /**
   * Every lock, by key.
   * @type {Record<string, EntryLock>}
   */
  locks: {},
  /**
   * Locks this tab has lost to someone who took them over, by key, so the editor can say so.
   * @type {Record<string, EntryLock>}
   */
  takenOver: {},
  /**
   * Keys of the locks the service refused without saying who holds them, e.g. as this tab holds too
   * many, so the editor can say others could be editing the entry too.
   * @type {Record<string, true>}
   */
  refused: {},
  /**
   * Who has each entry open, by lock key, leaving out entries nobody has open.
   * @type {Record<string, EntryViewer[]>}
   */
  presence: {},
});

/**
 * IDs of this tab’s earlier connections, whose locks the service may keep for a while after the
 * connection has dropped, until it notices. Such a lock is still this tab’s.
 * @type {Set<string>}
 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const previousConnections = new Set();

/**
 * Ask for the lock of an entry, taking it over from one of this tab’s earlier connections, which
 * asking for it would be refused by until the service notices the connection has dropped.
 * @param {string} key Lock key.
 */
const requestLock = (key) => {
  const holder = entryLocks.locks[key]?.connection;

  sendSocketMessage({
    type: holder && previousConnections.has(holder) ? 'takeover' : 'acquire',
    key,
  });
};

/**
 * Keys of the locks this tab wants to hold, which are acquired again after a reconnection. Nothing
 * renders it, so it doesn’t need to be reactive.
 * @type {Set<string>}
 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const wantedKeys = new Set();
/**
 * Keys of the entries open in this tab’s editor, which are announced again after a reconnection.
 * @type {Set<string>}
 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const openKeys = new Set();

/**
 * Get the lock key of an entry: its entry key plus the branch, as the same entry can be edited on
 * different branches at once.
 * @param {string} collectionName Collection name.
 * @param {string} subPath Entry path without an extension, or the file name of a collection file.
 * @returns {string} Key.
 */
export const getLockKey = (collectionName, subPath) =>
  `${getEntryKey(collectionName, subPath)}@${repository.branch}`;

/**
 * Get the lock key of an entry draft, if it can be locked; see {@link getDraftEntryKey}.
 * @param {EntryDraft | null | undefined} draft Draft.
 * @returns {string | undefined} Key.
 */
export const getDraftLockKey = (draft) => {
  const key = getDraftEntryKey(draft);

  return key ? `${key}@${repository.branch}` : undefined;
};

/**
 * Get the lock on an entry held by anyone but this tab, if any.
 * @param {string | undefined} key Lock key.
 * @returns {EntryLock | undefined} Lock.
 */
export const getOthersLock = (key) => {
  const lock = key ? entryLocks.locks[key] : undefined;

  return lock && lock.connection !== entryLocks.connection ? lock : undefined;
};

/**
 * What the editor of an entry should say about its lock:
 * - `held`: someone else is editing it;
 * - `yours`: the user is editing it in another tab;
 * - `taken_over`: someone took it over from this tab;
 * - `unavailable`: locks can’t be checked, so someone could be editing it too.
 * @typedef {{ type: 'held' | 'yours' | 'taken_over', lock: EntryLock } |
 * { type: 'unavailable' }} LockNotice
 */

/**
 * Get what the editor of an entry should say about its lock.
 * @param {string | undefined} key Lock key, if the entry can be locked.
 * @returns {LockNotice | undefined} Notice, if any.
 */
export const getLockNotice = (key) => {
  if (!key) {
    return undefined;
  }

  const takenOver = entryLocks.takenOver[key];

  if (takenOver) {
    return { type: 'taken_over', lock: takenOver };
  }

  const lock = getOthersLock(key);

  if (lock) {
    return { type: lock.user_id === entryLocks.userId ? 'yours' : 'held', lock };
  }

  return socketState.status === 'unavailable' || entryLocks.refused[key]
    ? { type: 'unavailable' }
    : undefined;
};

/**
 * Forget the locks once the user has signed out. The service releases this tab’s locks after a
 * grace period, as the socket is closed.
 */
const forgetLocks = () => {
  previousConnections.clear();
  wantedKeys.clear();
  openKeys.clear();
  Object.assign(entryLocks, {
    connection: '',
    userId: '',
    locks: {},
    takenOver: {},
    refused: {},
    presence: {},
  });
};

/**
 * Acquire the lock of an entry opened in the editor. If someone else holds it, the editor offers to
 * take it over.
 * @param {string} key Lock key.
 */
export const acquireLock = (key) => {
  wantedKeys.add(key);
  delete entryLocks.takenOver[key];
  delete entryLocks.refused[key];
  requestLock(key);
};

/**
 * Take over the lock of an entry from whoever holds it. Their editor becomes read-only.
 * @param {string} key Lock key.
 */
export const takeOverLock = (key) => {
  wantedKeys.add(key);
  delete entryLocks.takenOver[key];
  delete entryLocks.refused[key];
  sendSocketMessage({ type: 'takeover', key });
};

/**
 * Release the lock of an entry when the editor closes.
 * @param {string} key Lock key.
 */
export const releaseLock = (key) => {
  wantedKeys.delete(key);
  delete entryLocks.takenOver[key];
  delete entryLocks.refused[key];

  if (entryLocks.locks[key]?.connection === entryLocks.connection) {
    sendSocketMessage({ type: 'release', key });
  }
};

/**
 * Tell others that an entry is open in this tab’s editor, read-only or not, until
 * {@link closeEntry} is called. Anyone can, a viewer included.
 * @param {string} key Lock key.
 */
export const openEntry = (key) => {
  openKeys.add(key);
  sendSocketMessage({ type: 'open', key });
};

/**
 * Tell others that an entry is no longer open in this tab’s editor.
 * @param {string} key Lock key.
 */
export const closeEntry = (key) => {
  openKeys.delete(key);
  sendSocketMessage({ type: 'close', key });
};

/**
 * Tell others an entry is open in this tab’s editor, and hold its lock while it is, if the user can
 * edit it, until the editor closes it.
 * @param {string} key Lock key.
 * @param {object} options Options.
 * @param {boolean} options.hold Whether to hold the lock. Someone who can’t edit the entry, e.g. a
 * viewer, only lets others see they’re looking at it, or they would keep those who can from
 * editing it.
 * @returns {() => void} Function that lets the entry go.
 */
export const watchEntry = (key, { hold }) => {
  openEntry(key);

  if (hold) {
    acquireLock(key);
  }

  return () => {
    if (hold) {
      releaseLock(key);
    }

    closeEntry(key);
  };
};

/**
 * Get the other people who have an entry open, once each, as they may have it open in several
 * tabs. The user is left out, even in another tab, which the lock notice covers.
 * @param {string | undefined} key Lock key.
 * @returns {{ id: string, name: string }[]} People.
 */
export const getOtherViewers = (key) => {
  /** @type {Map<string, string>} */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const people = new Map();

  (key ? (entryLocks.presence[key] ?? []) : []).forEach(({ user_id: id, name }) => {
    if (id !== entryLocks.userId) {
      people.set(id, name);
    }
  });

  return [...people].map(([id, name]) => ({ id, name }));
};

/**
 * Get the other people who have an entry open, leaving out whoever is editing it, whose lock is
 * shown on its own.
 * @param {string} key Lock key.
 * @returns {{ id: string, name: string }[]} People.
 */
export const getOtherReaders = (key) => {
  const editorId = getOthersLock(key)?.user_id;

  return getOtherViewers(key).filter(({ id }) => id !== editorId);
};

/**
 * Start sharing entry locks for as long as the user is signed in, following the lock messages on
 * the socket, which the session connects.
 * @returns {() => void} Function that stops it, and forgets the locks.
 */
export const startLocks = () => {
  onSocketMessage('snapshot', (message) => {
    if (entryLocks.connection) {
      previousConnections.add(entryLocks.connection);
    }

    /** @type {Record<string, EntryLock>} */
    const locks = Object.fromEntries(
      message.locks.map((/** @type {EntryLock} */ lock) => [lock.key, lock]),
    );

    // Take back what this tab held before the connection dropped. A lock that has passed to someone
    // else in the meantime is refused, which the editor shows like any other. One the service still
    // keeps for the previous connection, as it hasn’t noticed it has closed, is taken over: asking
    // for it would be refused until it expires. It stays this tab’s meanwhile, so the editor
    // doesn’t turn read-only, as if someone else held it
    wantedKeys.forEach((key) => {
      const lock = locks[key];

      if (lock && previousConnections.has(lock.connection)) {
        locks[key] = { ...lock, connection: message.connection };
        sendSocketMessage({ type: 'takeover', key });
      } else {
        sendSocketMessage({ type: 'acquire', key });
      }
    });

    Object.assign(entryLocks, {
      connection: message.connection,
      userId: message.user_id,
      locks,
      refused: {},
      presence: message.presence ?? {},
    });

    // A lock taken over from this tab that has been let go while the connection was down: ask for
    // it, as when it’s let go while connected, or the editor would turn editable with nobody
    // holding it
    Object.keys(entryLocks.takenOver).forEach((key) => {
      if (!locks[key]) {
        acquireLock(key);
      }
    });
    // Say again what’s open here, as the service forgot it with the connection
    openKeys.forEach((key) => sendSocketMessage({ type: 'open', key }));
  });

  onSocketMessage('presence', ({ key, viewers }) => {
    if (viewers.length) {
      entryLocks.presence[key] = viewers;
    } else {
      delete entryLocks.presence[key];
    }
  });

  onSocketMessage('changed', ({ key, lock }) => {
    const previous = entryLocks.locks[key];

    if (lock) {
      entryLocks.locks[key] = lock;
    } else {
      delete entryLocks.locks[key];
    }

    // The editor was closed before the lock was given: let it go, or nobody else could edit the
    // entry until this tab closes
    if (lock?.connection === entryLocks.connection && !wantedKeys.has(key)) {
      sendSocketMessage({ type: 'release', key });
    }

    // Someone took over a lock this tab held: its editor becomes read-only
    if (
      lock &&
      previous?.connection === entryLocks.connection &&
      lock.connection !== previous.connection
    ) {
      wantedKeys.delete(key);
      entryLocks.takenOver[key] = lock;
    }

    // Whoever held it is done: this tab, which has the entry open in its editor read-only because
    // the lock was taken over or refused, gets it. Without asking, the editor would turn editable
    // with nobody holding the lock, so others could get it and edit the entry at the same time
    if (!lock && (entryLocks.takenOver[key] || wantedKeys.has(key))) {
      acquireLock(key);
    }
  });

  onSocketMessage('refused', ({ key, lock }) => {
    if (lock) {
      entryLocks.locks[key] = lock;
    } else if (wantedKeys.has(key)) {
      // Refused for another reason, e.g. too many locks: nobody else is told it’s being edited
      entryLocks.refused[key] = true;
    }
  });

  return forgetLocks;
};
