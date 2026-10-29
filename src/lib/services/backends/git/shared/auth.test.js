// @ts-nocheck
import { LocalStorage } from '@sveltia/utils/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cmsConfig } from '$lib/services/config';

import {
  authorize,
  cancelAuthorization,
  createAuthSecrets,
  finishClientSideAuth,
  formatHandshakeMessage,
  formatResultMessage,
  getTokens,
  handleAuthFlow,
  handleClientSideAuthPopup,
  inAuthPopup,
  initClientSideAuth,
  initServerSideAuth,
  openPopup,
  parseResultMessage,
  sendMessage,
  signInToBackend,
  signOut,
} from './auth';

vi.mock('@sveltia/utils/crypto', () => ({
  generateRandomId: vi.fn(() => 'random-id'),
  generateUUID: vi.fn(() => 'uuid123456789012'),
  getHash: vi.fn(async () => 'mocked-hash'),
}));

vi.mock('@sveltia/utils/storage');

vi.mock('$lib/services/config', () => ({
  cmsConfig: {
    current: {
      backend: {
        name: 'github',
        site_domain: 'example.com',
      },
    },
  },
}));

vi.mock('@sveltia/i18n', () => ({
  /**
   * Mock translation function.
   * @param {string} key Translation key.
   * @returns {string} Translated string.
   */
  _: (key) => `Translated: ${key}`,
}));

/**
 * Fake `BroadcastChannel` that, like a browser, delivers a message to every other open channel of
 * the same name, only synchronously.
 */
class FakeBroadcastChannel {
  /** @type {Set<FakeBroadcastChannel>} */
  static channels = new Set();

  /**
   * Constructor.
   * @param {string} name Channel name.
   */
  constructor(name) {
    this.name = name;
    /** @type {((event: { data: any }) => void) | null} */
    this.onmessage = null;
    FakeBroadcastChannel.channels.add(this);
  }

  /**
   * Post a message to the other channels of the same name.
   * @param {any} data Data.
   */
  postMessage(data) {
    FakeBroadcastChannel.channels.forEach((channel) => {
      if (channel !== this && channel.name === this.name) {
        channel.onmessage?.({ data });
      }
    });
  }

  /**
   * Close the channel.
   */
  close() {
    FakeBroadcastChannel.channels.delete(this);
  }
}

/**
 * Get the names of the open channels.
 * @returns {string[]} Names.
 */
const getOpenChannelNames = () => [...FakeBroadcastChannel.channels].map(({ name }) => name);

/**
 * Create a mock session storage backed by a `Map`.
 * @returns {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>} Storage.
 */
const createMockSessionStorage = () => {
  const store = new Map();

  return {
    getItem: vi.fn((key) => store.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key) => {
      store.delete(key);
    }),
  };
};

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
      sessionStorage: createMockSessionStorage(),
      close: vi.fn(),
    };

    mockPopup = {
      closed: false,
      close: vi.fn(),
      postMessage: vi.fn(),
      location: {
        href: '',
        replace: vi.fn(),
      },
    };

    // @ts-ignore - Mock window for testing
    global.window = mockWindow;
    global.btoa = vi.fn((str) => Buffer.from(str, 'binary').toString('base64'));

    // Mock LocalStorage methods
    vi.mocked(LocalStorage.set).mockResolvedValue();
    vi.mocked(LocalStorage.get).mockResolvedValue({});
    vi.mocked(LocalStorage.delete).mockResolvedValue();

    FakeBroadcastChannel.channels.clear();
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    cancelAuthorization.current = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('inAuthPopup store', () => {
    it('should be a writable store with initial value false', () => {
      expect(inAuthPopup.current).toBe(false);
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
        handler({
          data: 'authorizing:github',
          origin: 'https://localhost:3000',
          source: mockWindow.opener,
        });
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
        handler({
          data: 'authorizing:github',
          origin: 'https://localhost:3000',
          source: mockWindow.opener,
        });
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

      expect(mockWindow.opener.postMessage).toHaveBeenCalledWith(
        'authorizing:github',
        'https://localhost:3000',
      );

      // Simulate receiving the authorization message
      messageHandler({
        data: 'authorizing:github',
        origin: 'https://localhost:3000',
        source: mockWindow.opener,
      });

      expect(mockWindow.opener.postMessage).toHaveBeenCalledWith(
        'authorization:github:success:{"provider":"github","token":"test-token"}',
        'https://localhost:3000',
      );
    });
  });

  describe('authorize', () => {
    it('should resolve with token on successful authentication', async () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const backendName = 'github';
      const authPromise = authorize({ backendName, authURL });

      // Get the message handler
      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      // Simulate the first message
      messageHandler({
        data: 'authorizing:github',
        origin: 'https://github.com',
        source: mockPopup,
      });

      // Simulate the second message with success
      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://github.com',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({ token: 'test-token' });
      expect(mockPopup.close).toHaveBeenCalled();
    });

    it('should reject on authentication error', async () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const backendName = 'github';
      const authPromise = authorize({ backendName, authURL });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:github',
        origin: 'https://github.com',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:github:error:${JSON.stringify({ error: 'Auth failed' })}`,
        origin: 'https://github.com',
        source: mockPopup,
      });

      await expect(authPromise).rejects.toThrow('Authentication failed');
      expect(mockPopup.close).toHaveBeenCalled();
    });

    it('should reject when popup is closed prematurely (GitHub)', async () => {
      vi.useFakeTimers();
      mockPopup.closed = false;
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const backendName = 'github';
      const authPromise = authorize({ backendName, authURL });

      // Simulate popup being closed
      mockPopup.closed = true;
      vi.advanceTimersByTime(1000);

      await expect(authPromise).rejects.toThrow('Authentication aborted');

      vi.useRealTimers();
    });

    it.each(['gitea', 'forgejo'])(
      'should reject when popup is closed prematurely (%s)',
      async (backendName) => {
        vi.useFakeTimers();
        mockPopup.closed = false;

        const authPromise = authorize({
          backendName,
          authURL: 'https://localhost:3000/',
          popup: mockPopup,
        });

        mockPopup.closed = true;
        vi.advanceTimersByTime(1000);

        await expect(authPromise).rejects.toThrow('Authentication aborted');

        vi.useRealTimers();
      },
    );

    it('should not treat a popup on the GitLab sign-in page as closed', async () => {
      vi.useFakeTimers();
      // GitLab’s `Cross-Origin-Opener-Policy` makes `closed` read `true` while the popup is open
      mockPopup.closed = true;

      const authPromise = authorize({
        backendName: 'gitlab',
        authURL: 'https://localhost:3000/',
        popup: mockPopup,
      });

      vi.advanceTimersByTime(5000);

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: `authorization:gitlab:success:${JSON.stringify({ token: 'gitlab-token' })}`,
        origin: 'https://localhost:3000',
        source: mockPopup,
      });

      await expect(authPromise).resolves.toEqual({ token: 'gitlab-token' });

      vi.useRealTimers();
    });

    it('should keep popup timer active while popup is open (GitHub)', async () => {
      vi.useFakeTimers();
      mockPopup.closed = false;
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const backendName = 'github';
      const authPromise = authorize({ backendName, authURL });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      // Keep popup open through timer check
      mockPopup.closed = false;
      vi.advanceTimersByTime(500);

      // Popup is still open, so no rejection yet
      // Send valid auth message
      messageHandler({
        data: 'authorizing:github',
        origin: 'https://github.com',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://github.com',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({ token: 'test-token' });

      vi.useRealTimers();
    });

    it('should handle malformed response data', async () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const backendName = 'github';
      const authPromise = authorize({ backendName, authURL });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:github',
        origin: 'https://github.com',
        source: mockPopup,
      });

      messageHandler({
        data: 'authorization:github:success:invalid-json',
        origin: 'https://github.com',
        source: mockPopup,
      });

      await expect(authPromise).rejects.toThrow('Authentication failed');
    });

    it('should handle non-GitHub backends without popup timeout', async () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://gitlab.com/oauth/authorize';
      const backendName = 'gitlab';
      const authPromise = authorize({ backendName, authURL });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:gitlab',
        origin: 'https://gitlab.com',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:gitlab:success:${JSON.stringify({ token: 'gitlab-token' })}`,
        origin: 'https://gitlab.com',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({ token: 'gitlab-token' });
      expect(mockPopup.close).toHaveBeenCalled();
    });

    it('should handle missing regex match groups gracefully', async () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const backendName = 'github';
      const authPromise = authorize({ backendName, authURL });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:github',
        origin: 'https://github.com',
        source: mockPopup,
      });

      // Send a message that won't match the regex pattern
      messageHandler({
        data: 'authorization:github:invalid-format',
        origin: 'https://github.com',
        source: mockPopup,
      });

      await expect(authPromise).rejects.toThrow('Authentication failed');
    });

    it('should ignore non-string message data', async () => {
      vi.useFakeTimers();
      mockPopup.closed = false;
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const backendName = 'github';
      const authPromise = authorize({ backendName, authURL });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      // Send non-string data (should be ignored)
      messageHandler({
        data: { token: 'test' },
        origin: 'https://github.com',
        source: mockPopup,
      });

      // Then send valid data
      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://github.com',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({ token: 'test-token' });

      vi.useRealTimers();
    });

    it('should ignore messages from wrong origin', async () => {
      vi.useFakeTimers();
      mockPopup.closed = false;
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const backendName = 'github';
      const authPromise = authorize({ backendName, authURL });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      // Send message from wrong origin (should be ignored)
      messageHandler({
        data: 'authorizing:github',
        origin: 'https://evil.com',
        source: mockPopup,
      });

      // Then send valid message from correct origin
      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://github.com',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({ token: 'test-token' });

      vi.useRealTimers();
    });

    it('should handle non-object parsed response data', async () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const backendName = 'github';
      const authPromise = authorize({ backendName, authURL });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:github',
        origin: 'https://github.com',
        source: mockPopup,
      });

      // Send a message with valid JSON that is not an object (e.g., array or primitive)
      messageHandler({
        data: `authorization:github:success:${JSON.stringify(['token'])}`,
        origin: 'https://github.com',
        source: mockPopup,
      });

      await expect(authPromise).rejects.toThrow('Authentication failed');
    });

    it('should handle error response with errorCode', async () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const backendName = 'github';
      const authPromise = authorize({ backendName, authURL });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:github',
        origin: 'https://github.com',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:github:error:${JSON.stringify({ error: 'User denied', errorCode: 'access_denied' })}`,
        origin: 'https://github.com',
        source: mockPopup,
      });

      await expect(authPromise).rejects.toThrow();
    });
  });

  describe('initServerSideAuth', () => {
    it('should initialize server-side auth with provided siteDomain', async () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const args = {
        backendName: 'github',
        siteDomain: 'example.com',
        authURL: 'https://api.netlify.com',
        scope: 'repo',
      };

      const authPromise = initServerSideAuth(args);

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:github',
        origin: 'https://api.netlify.com',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://api.netlify.com',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({ token: 'test-token' });
    });

    it('should use localhost default when siteDomain is not provided', async () => {
      mockWindow.open.mockReturnValue(mockPopup);
      mockWindow.location.hostname = 'localhost';

      const args = {
        backendName: 'github',
        authURL: 'https://api.netlify.com',
        scope: 'repo',
      };

      const authPromise = initServerSideAuth(args);

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:github',
        origin: 'https://api.netlify.com',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://api.netlify.com',
        source: mockPopup,
      });

      await authPromise;

      // Check that it called authorize with cms.netlify.com as default
      expect(mockWindow.open).toHaveBeenCalled();
    });

    it('should handle IDN conversion for Netlify auth', async () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const args = {
        backendName: 'github',
        siteDomain: '日本語.jp',
        authURL: 'https://api.netlify.com',
        scope: 'repo',
      };

      const authPromise = initServerSideAuth(args);

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:github',
        origin: 'https://api.netlify.com',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://api.netlify.com',
        source: mockPopup,
      });

      await authPromise;
    });

    it('should use hostname as siteDomain when not localhost and not Netlify', async () => {
      mockWindow.open.mockReturnValue(mockPopup);
      mockWindow.location.hostname = 'example.com';

      const args = {
        backendName: 'github',
        authURL: 'https://github.com/login/oauth/authorize',
        scope: 'repo',
      };

      const authPromise = initServerSideAuth(args);

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:github',
        origin: 'https://github.com',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://github.com',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({ token: 'test-token' });
      expect(mockWindow.open).toHaveBeenCalled();
    });
  });

  describe('initClientSideAuth', () => {
    it('should initialize client-side auth with PKCE', async () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const args = {
        backendName: 'gitlab',
        clientId: 'test-client-id',
        authURL: 'https://gitlab.com/oauth/authorize',
        scope: 'api',
      };

      // Don't await immediately since LocalStorage.set is called internally
      const authPromise = initClientSideAuth(args);

      // Wait for the async operations and authorize call to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(mockWindow.open).toHaveBeenCalledWith(
        'https://localhost:3000/',
        'auth',
        expect.any(String),
      );
      expect(LocalStorage.set).toHaveBeenCalledWith('sveltia-cms.auth', expect.any(Object));
      expect(LocalStorage.set).toHaveBeenCalledWith('sveltia-cms.user', { backendName: 'gitlab' });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      expect(messageHandler).toBeDefined();

      messageHandler({
        data: 'authorizing:gitlab',
        origin: 'https://localhost:3000',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:gitlab:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://localhost:3000',
        source: mockPopup,
      });

      await authPromise;
    });

    it('should throw AbortError when popup cannot be opened', async () => {
      mockWindow.open.mockReturnValue(null);

      const args = {
        backendName: 'gitlab',
        clientId: 'test-client-id',
        authURL: 'https://gitlab.com/oauth/authorize',
        scope: 'api',
      };

      await expect(initClientSideAuth(args)).rejects.toMatchObject({
        message: 'Authentication aborted',
        name: 'AbortError',
      });
    });

    it('should throw AbortError when popup is closed during async operations', async () => {
      // Create a mock popup that appears closed
      const closedPopup = {
        closed: true,
        close: vi.fn(),
        postMessage: vi.fn(),
        location: {
          href: '',
          replace: vi.fn(),
        },
      };

      mockWindow.open.mockReturnValue(closedPopup);

      const args = {
        backendName: 'gitlab',
        clientId: 'test-client-id',
        authURL: 'https://gitlab.com/oauth/authorize',
        scope: 'api',
      };

      await expect(initClientSideAuth(args)).rejects.toMatchObject({
        message: 'Authentication aborted',
        name: 'AbortError',
      });
    });
  });

  describe('finishClientSideAuth', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
      mockWindow.location.href = 'https://localhost:3000/admin';
    });

    it('should finish auth successfully with valid token', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue({
        csrfToken: 'test-csrf',
        codeVerifier: 'test-verifier',
      });

      global.fetch.mockResolvedValue({
        /**
         * Mock JSON response.
         * @returns {Promise<object>} Token response.
         */
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
        }),
      });

      await finishClientSideAuth({
        backendName: 'gitlab',
        apiConfig: { clientId: 'test-client', tokenURL: 'https://gitlab.com/oauth/token' },
        code: 'test-code',
        state: 'test-csrf',
      });

      expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
      expect(fetch).toHaveBeenCalledWith('https://gitlab.com/oauth/token', expect.any(Object));
    });

    it('should detect CSRF attack', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue({
        csrfToken: 'test-csrf',
        codeVerifier: 'test-verifier',
      });

      await finishClientSideAuth({
        backendName: 'gitlab',
        apiConfig: { clientId: 'test-client', tokenURL: 'https://gitlab.com/oauth/token' },
        code: 'test-code',
        state: 'wrong-csrf',
      });

      expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
    });

    it('should handle missing stored auth data', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue(null);

      await finishClientSideAuth({
        backendName: 'gitlab',
        apiConfig: { clientId: 'test-client', tokenURL: 'https://gitlab.com/oauth/token' },
        code: 'test-code',
        state: 'test-csrf',
      });

      expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
    });

    it('should handle fetch failure', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue({
        csrfToken: 'test-csrf',
        codeVerifier: 'test-verifier',
      });

      global.fetch.mockRejectedValue(new Error('Network error'));

      await finishClientSideAuth({
        backendName: 'gitlab',
        apiConfig: { clientId: 'test-client', tokenURL: 'https://gitlab.com/oauth/token' },
        code: 'test-code',
        state: 'test-csrf',
      });

      expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
    });

    it('should reject insecure token request URLs', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue({
        csrfToken: 'test-csrf',
        codeVerifier: 'test-verifier',
      });

      await finishClientSideAuth({
        backendName: 'gitlab',
        apiConfig: { clientId: 'test-client', tokenURL: 'http://gitlab.example.com/oauth/token' },
        code: 'test-code',
        state: 'test-csrf',
      });

      expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
      expect(fetch).not.toHaveBeenCalled();
      expect(mockWindow.opener.postMessage).toHaveBeenCalledWith(
        'authorizing:gitlab',
        'https://localhost:3000',
      );
    });

    it('should handle malformed JSON response', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue({
        csrfToken: 'test-csrf',
        codeVerifier: 'test-verifier',
      });

      global.fetch.mockResolvedValue({
        /**
         * Mock JSON response that throws.
         * @throws {Error} Invalid JSON error.
         */
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await finishClientSideAuth({
        backendName: 'gitlab',
        apiConfig: { clientId: 'test-client', tokenURL: 'https://gitlab.com/oauth/token' },
        code: 'test-code',
        state: 'test-csrf',
      });

      expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
    });

    it('should include credentials in token request when includeCredentials is true', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue({
        csrfToken: 'test-csrf',
        codeVerifier: 'test-verifier',
      });

      global.fetch = vi.fn().mockResolvedValue({
        // eslint-disable-next-line jsdoc/require-jsdoc
        json: async () => ({ access_token: 'test-token' }),
      });

      await finishClientSideAuth({
        backendName: 'gitlab',
        apiConfig: {
          clientId: 'test-client',
          tokenURL: 'https://gitlab.com/oauth/token',
          includeCredentials: true,
        },
        code: 'test-code',
        state: 'test-csrf',
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://gitlab.com/oauth/token',
        expect.objectContaining({ credentials: 'include' }),
      );
    });
  });

  describe('handleClientSideAuthPopup', () => {
    beforeEach(() => {
      mockWindow.location.href = 'https://localhost:3000/admin';
    });

    it('should finish auth when code and state are present', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue({
        csrfToken: 'test-csrf',
        codeVerifier: 'test-verifier',
      });

      mockWindow.location.search = '?code=test-code&state=test-csrf';

      global.fetch = vi.fn().mockResolvedValue({
        /**
         * Mock JSON response.
         * @returns {Promise<object>} Token response.
         */
        json: async () => ({
          access_token: 'test-token',
        }),
      });

      await handleClientSideAuthPopup({
        backendName: 'gitlab',
        apiConfig: { clientId: 'test-client', tokenURL: 'https://gitlab.com/oauth/token' },
      });

      expect(inAuthPopup.current).toBe(true);
    });

    it('should redirect to auth URL when no code is present', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue({
        realAuthURL: 'https://gitlab.com/oauth/authorize?params',
      });

      mockWindow.location.search = '';
      mockWindow.location.href = '';

      await handleClientSideAuthPopup({
        backendName: 'gitlab',
        apiConfig: { clientId: 'test-client', tokenURL: 'https://gitlab.com/oauth/token' },
      });

      expect(mockWindow.location.href).toBe('https://gitlab.com/oauth/authorize?params');
    });

    it('should report a denied authorization to the opener', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue({
        csrfToken: 'test-csrf',
        codeVerifier: 'test-verifier',
        realAuthURL: 'https://gitlab.com/oauth/authorize?params',
      });

      mockWindow.location.search =
        '?error=access_denied&error_description=The+user+denied+the+request&state=test-csrf';
      mockWindow.location.href = '';

      await handleClientSideAuthPopup({
        backendName: 'gitlab',
        apiConfig: { clientId: 'test-client', tokenURL: 'https://gitlab.com/oauth/token' },
      });

      // The authorization page isn’t shown again
      expect(mockWindow.location.href).toBe('');
      expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
      expect(mockWindow.opener.postMessage).toHaveBeenCalledWith(
        'authorizing:gitlab',
        'https://localhost:3000',
      );

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:gitlab',
        origin: 'https://localhost:3000',
        source: mockWindow.opener,
      });

      expect(mockWindow.opener.postMessage).toHaveBeenLastCalledWith(
        `authorization:gitlab:error:${JSON.stringify({
          provider: 'gitlab',
          error: 'The user denied the request',
          errorCode: 'AUTH_CODE_REQUEST_FAILED',
        })}`,
        'https://localhost:3000',
      );
    });

    it('should report a failed authorization without a description', async () => {
      mockWindow.location.search = '?error=server_error';

      await handleClientSideAuthPopup({
        backendName: 'gitea',
        apiConfig: { clientId: 'test-client', tokenURL: 'https://gitea.com/login/oauth/token' },
      });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:gitea',
        origin: 'https://localhost:3000',
        source: mockWindow.opener,
      });

      expect(mockWindow.opener.postMessage).toHaveBeenLastCalledWith(
        `authorization:gitea:error:${JSON.stringify({
          provider: 'gitea',
          error: 'server_error',
          errorCode: 'AUTH_CODE_REQUEST_FAILED',
        })}`,
        'https://localhost:3000',
      );
    });

    it('should do nothing when no auth data is stored', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue(null);

      mockWindow.location.search = '';

      await handleClientSideAuthPopup({
        backendName: 'gitlab',
        apiConfig: { clientId: 'test-client', tokenURL: 'https://gitlab.com/oauth/token' },
      });

      expect(inAuthPopup.current).toBe(true);
    });

    it('should pass includeCredentials through to finishClientSideAuth', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue({
        csrfToken: 'test-csrf',
        codeVerifier: 'test-verifier',
      });

      mockWindow.location.search = '?code=test-code&state=test-csrf';

      global.fetch = vi.fn().mockResolvedValue({
        // eslint-disable-next-line jsdoc/require-jsdoc
        json: async () => ({ access_token: 'test-token' }),
      });

      await handleClientSideAuthPopup({
        backendName: 'gitlab',
        apiConfig: {
          clientId: 'test-client',
          tokenURL: 'https://gitlab.com/oauth/token',
          includeCredentials: true,
        },
      });

      expect(fetch).toHaveBeenCalledWith(
        'https://gitlab.com/oauth/token',
        expect.objectContaining({ credentials: 'include' }),
      );
    });
  });

  describe('handleAuthFlow', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
      mockWindow.location.href = 'https://localhost:3000/admin';
      mockWindow.opener = null;
    });

    it('should handle GitHub server-side auth flow', async () => {
      mockWindow.open.mockReturnValue(mockPopup);
      cmsConfig.current = /** @type {any} */ ({
        backend: {
          name: 'github',
          site_domain: 'example.com',
        },
      });

      const apiConfig = {
        clientId: 'github-client-id',
        authScope: 'repo',
        authURL: 'https://github.com/login/oauth/authorize',
        tokenURL: 'https://github.com/login/oauth/access_token',
      };

      const authPromise = handleAuthFlow({ auto: false, apiConfig });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:github',
        origin: 'https://github.com',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({
          token: 'github-token',
          refreshToken: 'github-refresh-token',
        })}`,
        origin: 'https://github.com',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({
        token: 'github-token',
        refreshToken: 'github-refresh-token',
      });
    });

    it('should handle GitLab PKCE auth flow', async () => {
      mockWindow.open.mockReturnValue(mockPopup);
      cmsConfig.current = /** @type {any} */ ({
        backend: {
          name: 'gitlab',
          site_domain: 'example.com',
          auth_type: 'pkce',
        },
      });

      const apiConfig = {
        clientId: 'gitlab-client-id',
        authScope: 'api',
        authURL: 'https://gitlab.com/oauth/authorize',
        tokenURL: 'https://gitlab.com/oauth/token',
      };

      const authPromise = handleAuthFlow({ auto: false, apiConfig });

      // Wait for async operations and authorize call to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(mockWindow.open).toHaveBeenCalledWith(
        'https://localhost:3000/',
        'auth',
        expect.any(String),
      );
      expect(LocalStorage.set).toHaveBeenCalledWith('sveltia-cms.auth', expect.any(Object));
      expect(LocalStorage.set).toHaveBeenCalledWith('sveltia-cms.user', { backendName: 'gitlab' });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      expect(messageHandler).toBeDefined();

      messageHandler({
        data: 'authorizing:gitlab',
        origin: 'https://localhost:3000',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:gitlab:success:${JSON.stringify({
          token: 'gitlab-token',
          refreshToken: 'gitlab-refresh-token',
        })}`,
        origin: 'https://localhost:3000',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({
        token: 'gitlab-token',
        refreshToken: 'gitlab-refresh-token',
      });
    });

    it.each(['gitea', 'forgejo'])('should handle %s PKCE auth flow', async (name) => {
      mockWindow.open.mockReturnValue(mockPopup);
      cmsConfig.current = /** @type {any} */ ({
        backend: {
          name,
          site_domain: 'gitea.example.com',
        },
      });

      const apiConfig = {
        clientId: 'gitea-client-id',
        authScope: 'api',
        authURL: 'https://gitea.example.com/login/oauth/authorize',
        tokenURL: 'https://gitea.example.com/login/oauth/token',
      };

      const authPromise = handleAuthFlow({ auto: false, apiConfig });

      // Wait for async operations and authorize call to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 50);
      });

      expect(mockWindow.open).toHaveBeenCalledWith(
        'https://localhost:3000/',
        'auth',
        expect.any(String),
      );
      expect(LocalStorage.set).toHaveBeenCalledWith('sveltia-cms.auth', expect.any(Object));

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      expect(messageHandler).toBeDefined();

      messageHandler({
        data: `authorizing:${name}`,
        origin: 'https://localhost:3000',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:${name}:success:${JSON.stringify({
          token: 'gitea-token',
          refreshToken: 'gitea-refresh-token',
        })}`,
        origin: 'https://localhost:3000',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({
        token: 'gitea-token',
        refreshToken: 'gitea-refresh-token',
      });
    });

    it('should return undefined for automatic sign-in with Gitea PKCE', async () => {
      cmsConfig.current = /** @type {any} */ ({
        backend: {
          name: 'gitea',
          site_domain: 'gitea.example.com',
        },
      });

      const apiConfig = {
        clientId: 'gitea-client-id',
        authScope: 'api',
        authURL: 'https://gitea.example.com/login/oauth/authorize',
        tokenURL: 'https://gitea.example.com/login/oauth/token',
      };

      const result = await handleAuthFlow({ auto: true, apiConfig });

      expect(result).toBeUndefined();
    });

    it('should return undefined for automatic sign-in with GitHub', async () => {
      cmsConfig.current = /** @type {any} */ ({
        backend: {
          name: 'github',
          site_domain: 'example.com',
        },
      });

      const apiConfig = {
        clientId: 'github-client-id',
        authScope: 'repo',
        authURL: 'https://github.com/login/oauth/authorize',
        tokenURL: 'https://github.com/login/oauth/access_token',
      };

      const result = await handleAuthFlow({ auto: true, apiConfig });

      expect(result).toBeUndefined();
    });

    it('should start the PKCE flow when the CMS was opened from another origin', async () => {
      mockWindow.opener = {
        /**
         * Reading a property of a cross-origin opener throws.
         * @throws {DOMException} Always.
         */
        get origin() {
          throw new DOMException(
            'Blocked a frame from accessing a cross-origin frame',
            'SecurityError',
          );
        },
      };
      mockWindow.name = '';
      mockWindow.open.mockReturnValue(mockPopup);
      cmsConfig.current = /** @type {any} */ ({
        backend: { name: 'gitea', site_domain: 'gitea.example.com' },
      });

      const apiConfig = {
        clientId: 'gitea-client-id',
        authScope: 'api',
        authURL: 'https://gitea.example.com/login/oauth/authorize',
        tokenURL: 'https://gitea.example.com/login/oauth/token',
      };

      const authPromise = handleAuthFlow({ auto: false, apiConfig });

      await vi.waitFor(() => {
        expect(mockWindow.addEventListener).toHaveBeenCalledWith(
          'message',
          expect.any(Function),
          expect.any(Object),
        );
      });

      expect(mockWindow.open).toHaveBeenCalledWith(
        'https://localhost:3000/',
        'auth',
        expect.any(String),
      );

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: `authorization:gitea:success:${JSON.stringify({ token: 'gitea-token' })}`,
        origin: 'https://localhost:3000',
        source: mockPopup,
      });

      await expect(authPromise).resolves.toEqual({ token: 'gitea-token' });
    });

    it('should return undefined when in auth popup for Gitea', async () => {
      mockWindow.opener = {
        origin: 'https://localhost:3000',
        postMessage: vi.fn(),
      };
      mockWindow.name = 'auth';

      cmsConfig.current = /** @type {any} */ ({
        backend: {
          name: 'gitea',
          site_domain: 'gitea.example.com',
        },
      });

      vi.mocked(LocalStorage.get).mockResolvedValue({
        csrfToken: 'test-csrf',
        codeVerifier: 'test-verifier',
      });

      global.fetch.mockResolvedValue({
        /**
         * Mock JSON response.
         * @returns {Promise<object>} Token response.
         */
        json: async () => ({
          access_token: 'gitea-token',
        }),
      });

      mockWindow.location.search = '?code=test-code&state=test-csrf';

      const apiConfig = {
        clientId: 'gitea-client-id',
        authScope: 'api',
        authURL: 'https://gitea.example.com/login/oauth/authorize',
        tokenURL: 'https://gitea.example.com/login/oauth/token',
      };

      const result = await handleAuthFlow({ auto: false, apiConfig });

      expect(result).toBeUndefined();
    });
  });

  describe('getTokens', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
      mockWindow.open.mockReturnValue(mockPopup);
      mockWindow.location.href = 'https://localhost:3000/admin';
      mockWindow.opener = null;
    });

    it('should return existing tokens without calling handleAuthFlow', async () => {
      const apiConfig = {
        clientId: 'github-client-id',
        authScope: 'repo',
        authURL: 'https://github.com/login/oauth/authorize',
        tokenURL: 'https://github.com/login/oauth/access_token',
      };

      const options = {
        token: 'existing-token',
        refreshToken: 'existing-refresh-token',
        auto: false,
      };

      const result = await getTokens({ options, apiConfig });

      expect(result).toEqual({
        token: 'existing-token',
        refreshToken: 'existing-refresh-token',
      });
    });

    it('should call handleAuthFlow and return tokens when token is not provided', async () => {
      cmsConfig.current = /** @type {any} */ ({
        backend: {
          name: 'github',
          site_domain: 'example.com',
        },
      });

      const apiConfig = {
        clientId: 'github-client-id',
        authScope: 'repo',
        authURL: 'https://github.com/login/oauth/authorize',
        tokenURL: 'https://github.com/login/oauth/access_token',
      };

      const options = {
        token: undefined,
        refreshToken: undefined,
        auto: false,
      };

      const authPromise = getTokens({ options, apiConfig });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:github',
        origin: 'https://github.com',
        source: mockPopup,
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({
          token: 'new-token',
          refreshToken: 'new-refresh-token',
        })}`,
        origin: 'https://github.com',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({
        token: 'new-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should return undefined for automatic sign-in without token', async () => {
      cmsConfig.current = /** @type {any} */ ({
        backend: {
          name: 'github',
          site_domain: 'example.com',
        },
      });

      const apiConfig = {
        clientId: 'github-client-id',
        authScope: 'repo',
        authURL: 'https://github.com/login/oauth/authorize',
        tokenURL: 'https://github.com/login/oauth/access_token',
      };

      const options = {
        token: undefined,
        refreshToken: undefined,
        auto: true,
      };

      const result = await getTokens({ options, apiConfig });

      expect(result).toBeUndefined();
    });

    it('should handle handleAuthFlow returning undefined', async () => {
      cmsConfig.current = /** @type {any} */ ({
        backend: {
          name: 'gitea',
          site_domain: 'gitea.example.com',
        },
      });

      mockWindow.opener = {
        origin: 'https://localhost:3000',
        postMessage: vi.fn(),
      };
      mockWindow.name = 'auth';

      const apiConfig = {
        clientId: 'gitea-client-id',
        authScope: 'api',
        authURL: 'https://gitea.example.com/login/oauth/authorize',
        tokenURL: 'https://gitea.example.com/login/oauth/token',
      };

      const options = {
        token: undefined,
        refreshToken: undefined,
        auto: false,
      };

      vi.mocked(LocalStorage.get).mockResolvedValue({
        csrfToken: 'test-csrf',
        codeVerifier: 'test-verifier',
      });

      global.fetch.mockResolvedValue({
        /**
         * Mock JSON response.
         * @returns {Promise<object>} Token response.
         */
        json: async () => ({
          access_token: 'gitea-token',
        }),
      });

      mockWindow.location.search = '?code=test-code&state=test-csrf';

      const result = await getTokens({ options, apiConfig });

      expect(result).toBeUndefined();
    });

    it('should preserve refreshToken when not provided in options', async () => {
      const apiConfig = {
        clientId: 'github-client-id',
        authScope: 'repo',
        authURL: 'https://github.com/login/oauth/authorize',
        tokenURL: 'https://github.com/login/oauth/access_token',
      };

      const options = {
        token: 'existing-token',
        refreshToken: 'existing-refresh-token',
        auto: false,
      };

      const result = await getTokens({ options, apiConfig });

      expect(result).toEqual({
        token: 'existing-token',
        refreshToken: 'existing-refresh-token',
      });
    });
  });

  describe('signInToBackend', () => {
    it('should fetch the user profile with existing tokens', async () => {
      const user = { id: 1, login: 'user', backendName: 'github' };
      const getUserProfile = vi.fn().mockResolvedValue(user);

      const result = await signInToBackend({
        options: { token: 'existing-token', refreshToken: 'existing-refresh-token', auto: false },
        getUserProfile,
      });

      expect(getUserProfile).toHaveBeenCalledWith({
        token: 'existing-token',
        refreshToken: 'existing-refresh-token',
      });
      expect(result).toEqual(user);
    });

    it('should return undefined without fetching the profile when no token is obtained', async () => {
      cmsConfig.current = /** @type {any} */ ({
        backend: { name: 'github', site_domain: 'example.com' },
      });

      const getUserProfile = vi.fn();

      const result = await signInToBackend({
        options: { token: undefined, refreshToken: undefined, auto: true },
        getUserProfile,
      });

      expect(result).toBeUndefined();
      expect(getUserProfile).not.toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('should resolve to undefined', async () => {
      await expect(signOut()).resolves.toBeUndefined();
    });
  });

  describe('authorize — popup-open timer tick (L60 false)', () => {
    it('should not reject when timer fires and popup is still open', async () => {
      vi.useFakeTimers();
      mockPopup.closed = false;
      mockWindow.open.mockReturnValue(mockPopup);

      const authURL = 'https://github.com/login/oauth/authorize';
      const backendName = 'github';
      const authPromise = authorize({ backendName, authURL });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      // Advance past one full 1 s interval with popup still open.
      // The timer callback fires, checks popup?.closed === false → L60 false branch (body skipped).
      mockPopup.closed = false;
      vi.advanceTimersByTime(1000);

      // Complete auth normally so the promise resolves rather than hanging.
      messageHandler({
        data: 'authorizing:github',
        origin: 'https://github.com',
        source: mockPopup,
      });
      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'ok' })}`,
        origin: 'https://github.com',
        source: mockPopup,
      });

      const result = await authPromise;

      expect(result).toEqual({ token: 'ok' });
      vi.useRealTimers();
    });
  });

  describe('sendMessage — sender validation', () => {
    /** @type {any} */
    let capturedHandler;

    beforeEach(() => {
      mockWindow.addEventListener = vi.fn((event, handler) => {
        if (event === 'message') capturedHandler = handler;
      });
    });

    it('should not send the token to a window other than the opener', () => {
      sendMessage({ provider: 'gitlab', token: 'secret-token' });

      capturedHandler({
        data: 'authorizing:gitlab',
        origin: 'https://localhost:3000',
        source: { postMessage: vi.fn() },
      });

      expect(mockWindow.opener.postMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('secret-token'),
        expect.any(String),
      );
      expect(mockWindow.removeEventListener).not.toHaveBeenCalled();
    });

    it('should not send the token to the opener when the message comes from another origin', () => {
      sendMessage({ provider: 'gitlab', token: 'secret-token' });

      capturedHandler({
        data: 'authorizing:gitlab',
        origin: 'https://evil.example',
        source: mockWindow.opener,
      });

      expect(mockWindow.opener.postMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('secret-token'),
        expect.any(String),
      );
    });

    it('should send the token once the opener asks from the same origin', () => {
      sendMessage({ provider: 'gitlab', token: 'secret-token' });

      capturedHandler({
        data: 'authorizing:gitlab',
        origin: 'https://localhost:3000',
        source: mockWindow.opener,
      });

      expect(mockWindow.opener.postMessage).toHaveBeenCalledWith(
        'authorization:gitlab:success:{"provider":"gitlab","token":"secret-token"}',
        'https://localhost:3000',
      );
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('message', capturedHandler);
    });
  });

  describe('authorize — sender validation', () => {
    it('should ignore messages that do not come from the popup', async () => {
      mockWindow.open.mockReturnValue(mockPopup);

      const authPromise = authorize({
        backendName: 'gitlab',
        authURL: 'https://localhost:3000/',
      });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      const otherWindow = { postMessage: vi.fn() };

      // A same-origin window other than the popup can neither start the handshake nor inject a
      // token
      messageHandler({
        data: 'authorizing:gitlab',
        origin: 'https://localhost:3000',
        source: otherWindow,
      });
      messageHandler({
        data: `authorization:gitlab:success:${JSON.stringify({ token: 'forged-token' })}`,
        origin: 'https://localhost:3000',
        source: otherWindow,
      });

      expect(mockPopup.postMessage).not.toHaveBeenCalled();
      expect(mockPopup.close).not.toHaveBeenCalled();

      messageHandler({
        data: `authorization:gitlab:success:${JSON.stringify({ token: 'real-token' })}`,
        origin: 'https://localhost:3000',
        source: mockPopup,
      });

      await expect(authPromise).resolves.toEqual({ token: 'real-token' });
    });

    it('should reject with an AbortError when there is no popup', async () => {
      mockWindow.open.mockReturnValue(null);

      await expect(
        authorize({ backendName: 'github', authURL: 'https://api.netlify.com/auth' }),
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(mockWindow.addEventListener).not.toHaveBeenCalled();
    });
  });

  describe('sendMessage — unrelated message event (L249 false)', () => {
    it('should ignore message events whose data does not match the authorizing prefix', () => {
      let capturedHandler;

      mockWindow.addEventListener = vi.fn((event, handler) => {
        if (event === 'message') capturedHandler = handler;
      });

      sendMessage({ provider: 'github', token: 'tok' });

      // Fire an unrelated message → data !== 'authorizing:github' → L249 false (body skipped).
      capturedHandler({ data: 'unrelated-message', origin: 'https://github.com' });

      // The opener should not have sent an authorization message for this unrelated event.
      expect(mockWindow.opener.postMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('authorization:'),
        expect.any(String),
      );
    });
  });

  describe('popup severed from its opener', () => {
    // GitLab’s sign-in page is served with `Cross-Origin-Opener-Policy: same-origin`, so the popup
    // comes back to the CMS without `window.opener` or `window.name`, and its result travels over a
    // `BroadcastChannel` named after the flow’s `state` instead
    const tokenMessage = `authorization:gitlab:success:${JSON.stringify({
      provider: 'gitlab',
      token: 'gitlab-token',
      refreshToken: 'gitlab-refresh-token',
    })}`;

    /**
     * Post a message on a channel, as the popup would.
     * @param {string} name Channel name.
     * @param {any} data Data.
     */
    const broadcast = (name, data) => {
      const channel = new BroadcastChannel(name);

      channel.postMessage(data);
      channel.close();
    };

    /**
     * Mock a successful token response.
     */
    const mockTokenResponse = () => {
      global.fetch = vi.fn().mockResolvedValue({
        /**
         * Mock JSON response.
         * @returns {Promise<object>} Token response.
         */
        json: async () => ({
          access_token: 'gitlab-token',
          refresh_token: 'gitlab-refresh-token',
        }),
      });
    };

    const apiConfig = {
      clientId: 'gitlab-client-id',
      authScope: 'api',
      authURL: 'https://gitlab.com/oauth/authorize',
      tokenURL: 'https://gitlab.com/oauth/token',
    };

    describe('authorize', () => {
      it('should resolve with the token sent over the flow’s channel', async () => {
        const authPromise = authorize({
          backendName: 'gitlab',
          authURL: 'https://localhost:3000/',
          popup: mockPopup,
          state: 'test-csrf',
        });

        expect(getOpenChannelNames()).toEqual(['sveltia-cms.auth.test-csrf']);

        broadcast('sveltia-cms.auth.test-csrf', tokenMessage);

        await expect(authPromise).resolves.toEqual({
          provider: 'gitlab',
          token: 'gitlab-token',
          refreshToken: 'gitlab-refresh-token',
        });
        expect(mockPopup.close).toHaveBeenCalled();
        expect(getOpenChannelNames()).toEqual([]);
        expect(cancelAuthorization.current).toBeUndefined();
      });

      it('should reject with the error sent over the flow’s channel', async () => {
        const authPromise = authorize({
          backendName: 'gitlab',
          authURL: 'https://localhost:3000/',
          popup: mockPopup,
          state: 'test-csrf',
        });

        broadcast(
          'sveltia-cms.auth.test-csrf',
          `authorization:gitlab:error:${JSON.stringify({ error: 'Denied' })}`,
        );

        await expect(authPromise).rejects.toMatchObject({
          message: 'Authentication failed',
          cause: { message: 'Denied' },
        });
        expect(getOpenChannelNames()).toEqual([]);
      });

      it('should ignore a token sent for another flow’s state', async () => {
        const authPromise = authorize({
          backendName: 'gitlab',
          authURL: 'https://localhost:3000/',
          popup: mockPopup,
          state: 'test-csrf',
        });

        const settled = vi.fn();

        authPromise.then(settled, settled);

        broadcast('sveltia-cms.auth.wrong-csrf', tokenMessage);
        // Non-string data is not a result either
        broadcast('sveltia-cms.auth.test-csrf', { token: 'injected-token' });
        await Promise.resolve();

        expect(settled).not.toHaveBeenCalled();
        expect(getOpenChannelNames()).toEqual(['sveltia-cms.auth.test-csrf']);

        cancelAuthorization.current();

        await expect(authPromise).rejects.toMatchObject({ name: 'AbortError' });
      });

      it('should not listen on any channel without a state', async () => {
        mockWindow.open.mockReturnValue(mockPopup);

        const authPromise = authorize({
          backendName: 'github',
          authURL: 'https://github.com/login/oauth/authorize',
        });

        expect(getOpenChannelNames()).toEqual([]);

        cancelAuthorization.current();

        await expect(authPromise).rejects.toMatchObject({ name: 'AbortError' });
      });

      it('should let the user cancel a sign-in whose popup can’t be checked', async () => {
        const authPromise = authorize({
          backendName: 'gitlab',
          authURL: 'https://localhost:3000/',
          popup: mockPopup,
          state: 'test-csrf',
        });

        expect(cancelAuthorization.current).toEqual(expect.any(Function));

        cancelAuthorization.current();

        await expect(authPromise).rejects.toMatchObject({
          message: 'Authentication aborted',
          name: 'AbortError',
        });
        expect(mockPopup.close).toHaveBeenCalled();
        expect(cancelAuthorization.current).toBeUndefined();
        expect(getOpenChannelNames()).toEqual([]);
        // The message listener is detached too
        expect(mockWindow.addEventListener.mock.calls[0][2].signal.aborted).toBe(true);
      });

      it('should clear the cancel function when the popup is found closed', async () => {
        vi.useFakeTimers();

        const authPromise = authorize({
          backendName: 'github',
          authURL: 'https://localhost:3000/',
          popup: mockPopup,
        });

        mockPopup.closed = true;
        vi.advanceTimersByTime(1000);

        await expect(authPromise).rejects.toMatchObject({ name: 'AbortError' });
        expect(cancelAuthorization.current).toBeUndefined();

        vi.useRealTimers();
      });
    });

    describe('initClientSideAuth', () => {
      const args = {
        backendName: 'gitlab',
        clientId: 'test-client-id',
        authURL: 'https://gitlab.com/oauth/authorize',
        scope: 'api',
      };

      it('should accept the result over the channel named after the state', async () => {
        mockWindow.open.mockReturnValue(mockPopup);

        const authPromise = initClientSideAuth(args);

        await vi.waitFor(() => {
          expect(getOpenChannelNames()).toEqual(['sveltia-cms.auth.uuid123456789012']);
        });

        expect(LocalStorage.set).toHaveBeenCalledWith(
          'sveltia-cms.auth',
          expect.objectContaining({ csrfToken: 'uuid123456789012' }),
        );

        broadcast('sveltia-cms.auth.uuid123456789012', tokenMessage);

        await expect(authPromise).resolves.toMatchObject({ token: 'gitlab-token' });
        expect(LocalStorage.delete).not.toHaveBeenCalled();
      });

      it('should remove the stored secret when the sign-in is cancelled', async () => {
        mockWindow.open.mockReturnValue(mockPopup);

        const authPromise = initClientSideAuth(args);

        await vi.waitFor(() => {
          expect(cancelAuthorization.current).toEqual(expect.any(Function));
        });

        cancelAuthorization.current();

        await expect(authPromise).rejects.toMatchObject({ name: 'AbortError' });
        // A severed popup could otherwise still finish the flow the user has given up on
        expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
      });
    });

    describe('sendMessage', () => {
      beforeEach(() => {
        mockWindow.opener = null;
      });

      it('should send the result over the channel and close the popup', () => {
        const receiver = new BroadcastChannel('sveltia-cms.auth.test-csrf');

        receiver.onmessage = vi.fn();

        sendMessage({
          provider: 'gitlab',
          state: 'test-csrf',
          token: 'gitlab-token',
          refreshToken: 'gitlab-refresh-token',
        });

        expect(receiver.onmessage).toHaveBeenCalledWith({ data: tokenMessage });
        expect(mockWindow.close).toHaveBeenCalled();
        expect(mockWindow.addEventListener).not.toHaveBeenCalled();
        expect(getOpenChannelNames()).toEqual(['sveltia-cms.auth.test-csrf']);

        receiver.close();
      });

      it('should do nothing without a state', () => {
        sendMessage({ provider: 'gitlab', token: 'gitlab-token' });

        expect(getOpenChannelNames()).toEqual([]);
        expect(mockWindow.close).not.toHaveBeenCalled();
        expect(mockWindow.addEventListener).not.toHaveBeenCalled();
      });
    });

    describe('handleClientSideAuthPopup', () => {
      it('should remember the flow before leaving for the authorization site', async () => {
        vi.mocked(LocalStorage.get).mockResolvedValue({
          csrfToken: 'test-csrf',
          codeVerifier: 'test-verifier',
          realAuthURL: 'https://gitlab.com/oauth/authorize?params',
        });

        mockWindow.location.search = '';

        await handleClientSideAuthPopup({ backendName: 'gitlab', apiConfig });

        expect(mockWindow.sessionStorage.getItem('sveltia-cms.auth-popup')).toBe('test-csrf');
        expect(mockWindow.location.href).toBe('https://gitlab.com/oauth/authorize?params');
      });

      it('should report a denied authorization over the channel', async () => {
        mockWindow.opener = null;
        mockWindow.sessionStorage.setItem('sveltia-cms.auth-popup', 'test-csrf');
        mockWindow.location.search = '?error=access_denied&state=test-csrf';

        const receiver = new BroadcastChannel('sveltia-cms.auth.test-csrf');

        receiver.onmessage = vi.fn();

        await handleClientSideAuthPopup({ backendName: 'gitlab', apiConfig });

        expect(receiver.onmessage).toHaveBeenCalledWith({
          data: `authorization:gitlab:error:${JSON.stringify({
            provider: 'gitlab',
            error: 'access_denied',
            errorCode: 'AUTH_CODE_REQUEST_FAILED',
          })}`,
        });
        expect(mockWindow.sessionStorage.getItem('sveltia-cms.auth-popup')).toBeNull();
        expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');

        receiver.close();
      });

      it('should keep going when session storage is unavailable', async () => {
        vi.mocked(LocalStorage.get).mockResolvedValue({
          csrfToken: 'test-csrf',
          realAuthURL: 'https://gitlab.com/oauth/authorize?params',
        });

        mockWindow.location.search = '';
        mockWindow.sessionStorage.setItem.mockImplementation(() => {
          throw new DOMException('Access denied', 'SecurityError');
        });

        await handleClientSideAuthPopup({ backendName: 'gitlab', apiConfig });

        expect(mockWindow.location.href).toBe('https://gitlab.com/oauth/authorize?params');
      });
    });

    describe('finishClientSideAuth', () => {
      beforeEach(() => {
        mockWindow.opener = null;
        mockWindow.location.href = 'https://localhost:3000/admin?code=test-code&state=test-csrf';
      });

      it('should never send a token for a wrong state', async () => {
        vi.mocked(LocalStorage.get).mockResolvedValue({
          csrfToken: 'test-csrf',
          codeVerifier: 'test-verifier',
        });
        mockTokenResponse();
        mockWindow.sessionStorage.setItem('sveltia-cms.auth-popup', 'wrong-csrf');

        const realFlow = new BroadcastChannel('sveltia-cms.auth.test-csrf');
        const wrongFlow = new BroadcastChannel('sveltia-cms.auth.wrong-csrf');

        realFlow.onmessage = vi.fn();
        wrongFlow.onmessage = vi.fn();

        await finishClientSideAuth({
          backendName: 'gitlab',
          apiConfig,
          code: 'test-code',
          state: 'wrong-csrf',
        });

        expect(fetch).not.toHaveBeenCalled();
        expect(realFlow.onmessage).not.toHaveBeenCalled();
        expect(wrongFlow.onmessage).toHaveBeenCalledWith({
          data: `authorization:gitlab:error:${JSON.stringify({
            provider: 'gitlab',
            error: 'Translated: sign_in_error.CSRF_DETECTED',
            errorCode: 'CSRF_DETECTED',
          })}`,
        });
        expect(wrongFlow.onmessage.mock.calls[0][0].data).not.toContain('token');
        expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
        expect(mockWindow.sessionStorage.getItem('sveltia-cms.auth-popup')).toBeNull();

        realFlow.close();
        wrongFlow.close();
      });

      it('should report a failed token request over the channel', async () => {
        vi.mocked(LocalStorage.get).mockResolvedValue({
          csrfToken: 'test-csrf',
          codeVerifier: 'test-verifier',
        });
        global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        const receiver = new BroadcastChannel('sveltia-cms.auth.test-csrf');

        receiver.onmessage = vi.fn();

        await finishClientSideAuth({
          backendName: 'gitlab',
          apiConfig,
          code: 'test-code',
          state: 'test-csrf',
        });

        expect(receiver.onmessage.mock.calls[0][0].data).toContain('TOKEN_REQUEST_FAILED');

        receiver.close();
      });

      it('should report a malformed token response over the channel', async () => {
        vi.mocked(LocalStorage.get).mockResolvedValue({
          csrfToken: 'test-csrf',
          codeVerifier: 'test-verifier',
        });
        global.fetch = vi.fn().mockResolvedValue({
          /**
           * Mock JSON response.
           * @throws {SyntaxError} Always.
           */
          json: async () => {
            throw new SyntaxError('Unexpected token');
          },
        });

        const receiver = new BroadcastChannel('sveltia-cms.auth.test-csrf');

        receiver.onmessage = vi.fn();

        await finishClientSideAuth({
          backendName: 'gitlab',
          apiConfig,
          code: 'test-code',
          state: 'test-csrf',
        });

        expect(receiver.onmessage.mock.calls[0][0].data).toContain('MALFORMED_RESPONSE');

        receiver.close();
      });
    });

    describe('handleAuthFlow', () => {
      beforeEach(() => {
        cmsConfig.current = /** @type {any} */ ({
          backend: { name: 'gitlab', auth_type: 'pkce' },
        });
        inAuthPopup.current = false;
        mockWindow.opener = null;
        mockWindow.name = '';
        mockWindow.location.href = 'https://localhost:3000/admin?code=test-code&state=test-csrf';
        mockWindow.location.search = '?code=test-code&state=test-csrf';
        vi.mocked(LocalStorage.get).mockResolvedValue({
          csrfToken: 'test-csrf',
          codeVerifier: 'test-verifier',
        });
        mockTokenResponse();
      });

      it('should finish the flow in a popup that remembers it, and send the token back', async () => {
        mockWindow.sessionStorage.setItem('sveltia-cms.auth-popup', 'test-csrf');

        const opener = authorize({
          backendName: 'gitlab',
          authURL: 'https://localhost:3000/admin',
          popup: mockPopup,
          state: 'test-csrf',
        });

        await expect(handleAuthFlow({ auto: true, apiConfig })).resolves.toBeUndefined();

        expect(inAuthPopup.current).toBe(true);
        await expect(opener).resolves.toEqual({
          provider: 'gitlab',
          token: 'gitlab-token',
          refreshToken: 'gitlab-refresh-token',
        });
        expect(mockWindow.close).toHaveBeenCalled();
        expect(mockWindow.sessionStorage.getItem('sveltia-cms.auth-popup')).toBeNull();
      });

      it('should not mistake a tab for the popup when the state doesn’t match', async () => {
        mockWindow.sessionStorage.setItem('sveltia-cms.auth-popup', 'other-csrf');

        await expect(handleAuthFlow({ auto: true, apiConfig })).resolves.toBeUndefined();

        expect(inAuthPopup.current).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
        expect(LocalStorage.delete).not.toHaveBeenCalled();
      });

      it('should not mistake a tab without a remembered flow for the popup', async () => {
        await expect(handleAuthFlow({ auto: true, apiConfig })).resolves.toBeUndefined();

        expect(inAuthPopup.current).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
      });

      it('should not mistake a tab without a state for the popup', async () => {
        mockWindow.sessionStorage.setItem('sveltia-cms.auth-popup', 'test-csrf');
        mockWindow.location.search = '?code=test-code';

        await expect(handleAuthFlow({ auto: true, apiConfig })).resolves.toBeUndefined();

        expect(inAuthPopup.current).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
      });

      it('should not treat the tab as the popup when session storage is unavailable', async () => {
        mockWindow.sessionStorage.getItem.mockImplementation(() => {
          throw new DOMException('Access denied', 'SecurityError');
        });

        await expect(handleAuthFlow({ auto: true, apiConfig })).resolves.toBeUndefined();

        expect(inAuthPopup.current).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
      });
    });
  });
});

describe('popup messages', () => {
  it('should format the handshake message', () => {
    expect(formatHandshakeMessage('github')).toBe('authorizing:github');
  });

  it('should format a result message, which parses back', () => {
    const content = { provider: 'github', token: 'abc' };
    const message = formatResultMessage('github', 'success', content);

    expect(message).toBe('authorization:github:success:{"provider":"github","token":"abc"}');
    expect(parseResultMessage('github', message)).toBe(JSON.stringify(content));
    expect(parseResultMessage('github', formatResultMessage('github', 'error', {}))).toBe('{}');
  });

  it('should not parse a message for another backend, another status or without a result', () => {
    expect(parseResultMessage('gitlab', 'authorization:github:success:{}')).toBeUndefined();
    expect(parseResultMessage('github', 'authorization:github:pending:{}')).toBeUndefined();
    expect(parseResultMessage('github', 'authorization:github:success:')).toBeUndefined();
    expect(parseResultMessage('github', 'authorizing:github')).toBeUndefined();
  });
});
