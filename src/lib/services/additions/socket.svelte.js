import { fetchAdditions } from '$lib/services/additions/api';
import { getAdditionsURL } from '$lib/services/app/additions';
import { user } from '$lib/services/user/account.svelte';
import { createGeneration } from '$lib/services/utils/generation';

/**
 * Delays before each reconnection attempt. The last one repeats.
 */
export const RECONNECT_DELAYS = [1000, 2000, 5000, 10_000, 30_000];

/**
 * State of the WebSocket connection to Sveltia CMS Additions, which shares entry locks, presence,
 * comment counts and credential changes.
 */
export const socketState = $state({
  /**
   * Connection state. `unavailable` while the service can’t be reached.
   * @type {'disconnected' | 'connecting' | 'connected' | 'unavailable'}
   */
  status: 'disconnected',
});

/** @type {WebSocket | undefined} */
let socket;
let reconnectAttempts = 0;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let reconnectTimer;
/** Whether a connection is being opened, while its ticket is requested. */
let connecting = false;
/** Bumped on every disconnection, so a connection opened in the meantime is dropped. */
const generation = createGeneration();
/**
 * Handlers of the messages on the socket, by message type.
 * @type {Map<string, (message: any) => void>}
 */
// eslint-disable-next-line svelte/prefer-svelte-reactivity
const socketListeners = new Map();

/**
 * Handle a type of message the socket sends, e.g. `changed` for a lock or `comments` for a comment
 * count. Each type has one handler. The `snapshot` message comes first on every connection; the
 * `connected` type is sent after it, with no data, so a listener can catch up with what it missed.
 * @param {string} type Message type.
 * @param {(message: any) => void} handler Handler.
 */
export const onSocketMessage = (type, handler) => {
  socketListeners.set(type, handler);
};

/**
 * Send a message if connected. Nothing is sent otherwise: whatever needs it again, e.g. a lock, is
 * sent once the `snapshot` of the next connection arrives.
 * @param {Record<string, any>} message Message.
 */
export const sendSocketMessage = (message) => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

/**
 * Handle a message from the service.
 * @param {any} message Message.
 */
const handleMessage = (message) => {
  if (message.type === 'snapshot') {
    socketState.status = 'connected';
    reconnectAttempts = 0;
  }

  socketListeners.get(message.type)?.(message);

  if (message.type === 'snapshot') {
    socketListeners.get('connected')?.({ type: 'connected' });
  }
};

/**
 * Connect to Sveltia CMS Additions, if the user is signed in to it. The connection is opened again
 * after it drops, e.g. when the service is deployed, with backoff.
 * @returns {Promise<void>}
 */
export const connectSocket = async () => {
  const sessionToken = user.account?.refreshToken;

  if (socket || connecting || !sessionToken) {
    return;
  }

  const isCurrent = generation.capture();

  clearTimeout(reconnectTimer);
  connecting = true;
  socketState.status = 'connecting';

  /** @type {WebSocket} */
  let ws;

  try {
    const { ticket } = await fetchAdditions('/v1/socket/ticket', {
      method: 'POST',
      token: sessionToken,
    });

    // The user signed out while the ticket was on its way
    if (!isCurrent()) {
      return;
    }

    ws = new WebSocket(
      `${getAdditionsURL().replace(/^http/, 'ws')}/v1/socket?ticket=${encodeURIComponent(ticket)}`,
    );
  } catch {
    if (isCurrent()) {
      // eslint-disable-next-line no-use-before-define
      scheduleReconnect();
    }

    return;
  } finally {
    // A connection opened since, e.g. after signing in again, is left to finish
    if (isCurrent()) {
      connecting = false;
    }
  }

  socket = ws;

  ws.addEventListener('message', ({ data }) => {
    try {
      handleMessage(JSON.parse(data));
    } catch {
      // Ignore a message that can’t be read
    }
  });

  ws.addEventListener('close', () => {
    // Replaced or disconnected on purpose
    if (socket !== ws) {
      return;
    }

    socket = undefined;
    // eslint-disable-next-line no-use-before-define
    scheduleReconnect();
  });
};

/**
 * Try connecting again after a delay.
 */
const scheduleReconnect = () => {
  socketState.status = 'unavailable';

  const delay = RECONNECT_DELAYS[Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1)];

  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    connectSocket();
  }, delay);
};

/**
 * Disconnect, e.g. when signing out. A connection still being opened is dropped once it’s ready.
 */
export const disconnectSocket = () => {
  const ws = socket;

  clearTimeout(reconnectTimer);
  generation.bump();
  // A connection still being opened is dropped, so the next one doesn’t wait for it
  connecting = false;
  socket = undefined;
  reconnectAttempts = 0;
  ws?.close(1000);
  socketState.status = 'disconnected';
};

/**
 * Keep the socket connected for as long as the user is signed in. Its listeners, e.g. for locks
 * and comments, are registered first, so none of them misses the first `snapshot`.
 * @returns {() => void} Function that disconnects it.
 */
export const startSocket = () => {
  connectSocket();

  return disconnectSocket;
};
