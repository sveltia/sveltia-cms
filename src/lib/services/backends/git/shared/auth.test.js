// @ts-nocheck
import { LocalStorage } from '@sveltia/utils/storage';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthSecrets, inAuthPopup, openPopup, sendMessage } from './auth';

vi.mock('@sveltia/utils/crypto', () => ({
  generateRandomId: vi.fn(() => 'random-id'),
  generateUUID: vi.fn(() => 'uuid123456789012'),
  getHash: vi.fn(async () => 'mocked-hash'),
}));

vi.mock('@sveltia/utils/storage');

vi.mock('svelte-i18n', () => ({
  _: vi.fn(() => ({ subscribe: vi.fn(), get: vi.fn(() => 'Mocked translation') })),
}));

describe('git/shared/auth', () => {
  /** @type {any} */
  let mockWindow;
  /** @type {any} */
  let mockPopup;

  beforeEach(() => {
    // Mock window object
    mockWindow = {
      screen: { availHeight: 1080, availWidth: 1920 },
      open: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      location: { hostname: 'localhost', origin: 'https://localhost:3000', pathname: '/' },
      opener: { postMessage: vi.fn() },
    };

    mockPopup = {
      closed: false,
      close: vi.fn(),
      postMessage: vi.fn(),
    };

    // @ts-ignore - Mock window for testing
    global.window = mockWindow;
    global.btoa = vi.fn((str) => Buffer.from(str, 'binary').toString('base64'));

    // Mock LocalStorage methods
    vi.mocked(LocalStorage.set).mockResolvedValue();
    vi.mocked(LocalStorage.get).mockResolvedValue({});
    vi.mocked(LocalStorage.delete).mockResolvedValue();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('inAuthPopup store', () => {
    it('should be a writable store with initial value false', () => {
      expect(get(inAuthPopup)).toBe(false);
    });
  });

  describe('openPopup', () => {
    it('should open a popup window with correct parameters', () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const result = openPopup({ authURL });

      expect(mockWindow.open).toHaveBeenCalledWith(
        authURL,
        'auth',
        'width=600,height=800,top=140,left=660',
      );
      expect(result).toBe(mockPopup);
    });

    it('should return null if popup could not be opened', () => {
      mockWindow.open.mockReturnValue(null);

      const authURL = 'https://github.com/login/oauth/authorize';
      const result = openPopup({ authURL });

      expect(result).toBe(null);
    });
  });

  describe('createAuthSecrets', () => {
    beforeEach(() => {
      global.btoa = vi.fn(() => 'base64-encoded-hash');
    });

    it('should create auth secrets with code verifier and challenge', async () => {
      const secrets = await createAuthSecrets();

      expect(secrets).toEqual({
        csrfToken: 'uuid123456789012',
        codeVerifier: 'random-idrandom-id',
        codeChallenge: 'base64-encoded-hash',
      });
    });
  });

  describe('sendMessage', () => {
    it('should send success message to opener', () => {
      const args = {
        provider: 'github',
        token: 'access-token',
        refreshToken: 'refresh-token',
      };

      sendMessage(args);

      // Simulate the message event
      const handler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      if (handler) {
        handler({ data: 'authorizing:github', origin: 'https://localhost:3000' });
      }

      expect(mockWindow.opener.postMessage).toHaveBeenCalledWith(
        `authorization:github:success:${JSON.stringify({
          provider: 'github',
          token: 'access-token',
          refreshToken: 'refresh-token',
        })}`,
        'https://localhost:3000',
      );
    });

    it('should send error message to opener', () => {
      const args = {
        provider: 'github',
        error: 'Authentication failed',
        errorCode: 'AUTH_FAILED',
      };

      sendMessage(args);

      const handler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      if (handler) {
        handler({ data: 'authorizing:github', origin: 'https://localhost:3000' });
      }

      expect(mockWindow.opener.postMessage).toHaveBeenCalledWith(
        `authorization:github:error:${JSON.stringify({
          provider: 'github',
          error: 'Authentication failed',
          errorCode: 'AUTH_FAILED',
        })}`,
        'https://localhost:3000',
      );
    });
  });

  describe('sendMessage', () => {
    it('should handle successful authentication message', () => {
      const mockEventListener = vi.fn();

      mockWindow.addEventListener = mockEventListener;

      sendMessage({
        provider: 'github',
        token: 'test-token',
        refreshToken: 'test-refresh-token',
      });

      expect(mockEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should handle error authentication message', () => {
      const mockEventListener = vi.fn();

      mockWindow.addEventListener = mockEventListener;

      sendMessage({
        provider: 'gitlab',
        error: 'Authentication failed',
        errorCode: 'INVALID_CREDENTIALS',
      });

      expect(mockEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should post message to opener when authorization message is received', () => {
      let messageHandler;

      mockWindow.addEventListener = vi.fn((event, handler) => {
        if (event === 'message') {
          messageHandler = handler;
        }
      });

      sendMessage({
        provider: 'github',
        token: 'test-token',
      });

      // Simulate receiving the authorization message
      messageHandler({
        data: 'authorizing:github',
        origin: 'https://example.com',
      });

      expect(mockWindow.opener.postMessage).toHaveBeenCalledWith(
        'authorization:github:success:{"provider":"github","token":"test-token"}',
        'https://example.com',
      );
    });
  });
});
