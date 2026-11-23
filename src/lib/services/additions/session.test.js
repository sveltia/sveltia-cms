import { describe, expect, test, vi } from 'vitest';

import { loadSignInMethods, startTokenRefresh } from '$lib/services/additions/auth.svelte';
import { startComments } from '$lib/services/additions/comments.svelte';
import { startConversations } from '$lib/services/additions/conversation.svelte';
import { startCredentials } from '$lib/services/additions/credentials.svelte';
import { startLocks } from '$lib/services/additions/locks.svelte';
import { prepareSignIn, startSession } from '$lib/services/additions/session';
import { readSetupResult } from '$lib/services/additions/setup.svelte';
import { startSocket } from '$lib/services/additions/socket.svelte';

const { stops } = vi.hoisted(() => ({
  stops: {
    comments: vi.fn(),
    conversations: vi.fn(),
    credentials: vi.fn(),
    locks: vi.fn(),
    socket: vi.fn(),
    tokenRefresh: vi.fn(),
  },
}));

vi.mock('$lib/services/additions/auth.svelte', () => ({
  loadSignInMethods: vi.fn(),
  startTokenRefresh: vi.fn(() => stops.tokenRefresh),
}));
vi.mock('$lib/services/additions/comments.svelte', () => ({
  startComments: vi.fn(() => stops.comments),
}));
vi.mock('$lib/services/additions/conversation.svelte', () => ({
  startConversations: vi.fn(() => stops.conversations),
}));
vi.mock('$lib/services/additions/credentials.svelte', () => ({
  startCredentials: vi.fn(() => stops.credentials),
}));
vi.mock('$lib/services/additions/locks.svelte', () => ({ startLocks: vi.fn(() => stops.locks) }));
vi.mock('$lib/services/additions/setup.svelte', () => ({ readSetupResult: vi.fn() }));
vi.mock('$lib/services/additions/socket.svelte', () => ({
  startSocket: vi.fn(() => stops.socket),
}));

describe('prepareSignIn()', () => {
  test('reads the setup result and the sign-in methods', () => {
    prepareSignIn();

    expect(readSetupResult).toHaveBeenCalledOnce();
    expect(loadSignInMethods).toHaveBeenCalledOnce();
  });
});

describe('startSession()', () => {
  test('starts the shared state, and stops it', () => {
    const stop = startSession();

    [
      startComments,
      startConversations,
      startCredentials,
      startLocks,
      startSocket,
      startTokenRefresh,
    ].forEach((start) => {
      expect(start).toHaveBeenCalledOnce();
    });
    Object.values(stops).forEach((fn) => expect(fn).not.toHaveBeenCalled());

    stop();
    Object.values(stops).forEach((fn) => expect(fn).toHaveBeenCalledOnce());
  });
});
