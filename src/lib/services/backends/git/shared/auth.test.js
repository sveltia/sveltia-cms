// @ts-nocheck
import { LocalStorage } from '@sveltia/utils/storage';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { siteConfig } from '$lib/services/config';

import {
  authorize,
  createAuthSecrets,
  finishClientSideAuth,
  getTokens,
  handleAuthFlow,
  handleClientSideAuthPopup,
  inAuthPopup,
  initClientSideAuth,
  initServerSideAuth,
  openPopup,
  sendMessage,
} from './auth';

vi.mock('@sveltia/utils/crypto', () => ({
  generateRandomId: vi.fn(() => 'random-id'),
  generateUUID: vi.fn(() => 'uuid123456789012'),
  getHash: vi.fn(async () => 'mocked-hash'),
}));

vi.mock('@sveltia/utils/storage');

vi.mock('$lib/services/config', () => ({
  siteConfig: {
    subscribe: vi.fn((fn) => {
      fn({
        backend: {
          name: 'github',
          site_domain: 'example.com',
        },
      });

      return () => {};
    }),
  },
}));

vi.mock('svelte-i18n', () => {
  /**
   * Mock translation function.
   * @param {string} key Translation key.
   * @returns {string} Translated string.
   */
  const mockTranslate = (key) => `Translated: ${key}`;

  const mockStore = {
    /**
     * Subscribe to store changes.
     * @param {(value: (key: string) => string) => void} fn Subscriber function.
     * @returns {() => void} Unsubscribe function.
     */
    subscribe: (fn) => {
      fn(mockTranslate);

      return () => {};
    },
  };

  return { _: mockStore };
});

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
      });

      // Simulate the second message with success
      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://github.com',
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
      });

      messageHandler({
        data: `authorization:github:error:${JSON.stringify({ error: 'Auth failed' })}`,
        origin: 'https://github.com',
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
      });

      messageHandler({
        data: 'authorization:github:success:invalid-json',
        origin: 'https://github.com',
      });

      await expect(authPromise).rejects.toThrow('Authentication failed');
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
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://api.netlify.com',
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
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://api.netlify.com',
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
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://api.netlify.com',
      });

      await authPromise;
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

      // Wait a bit for the async LocalStorage.set calls to complete
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect(LocalStorage.set).toHaveBeenCalledWith('sveltia-cms.auth', expect.any(Object));
      expect(LocalStorage.set).toHaveBeenCalledWith('sveltia-cms.user', { backendName: 'gitlab' });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:gitlab',
        origin: 'https://localhost:3000',
      });

      messageHandler({
        data: `authorization:gitlab:success:${JSON.stringify({ token: 'test-token' })}`,
        origin: 'https://localhost:3000',
      });

      await authPromise;
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
        clientId: 'test-client',
        tokenURL: 'https://gitlab.com/oauth/token',
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
        clientId: 'test-client',
        tokenURL: 'https://gitlab.com/oauth/token',
        code: 'test-code',
        state: 'wrong-csrf',
      });

      expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
    });

    it('should handle missing stored auth data', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue(null);

      await finishClientSideAuth({
        backendName: 'gitlab',
        clientId: 'test-client',
        tokenURL: 'https://gitlab.com/oauth/token',
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
        clientId: 'test-client',
        tokenURL: 'https://gitlab.com/oauth/token',
        code: 'test-code',
        state: 'test-csrf',
      });

      expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
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
        clientId: 'test-client',
        tokenURL: 'https://gitlab.com/oauth/token',
        code: 'test-code',
        state: 'test-csrf',
      });

      expect(LocalStorage.delete).toHaveBeenCalledWith('sveltia-cms.auth');
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
        clientId: 'test-client',
        tokenURL: 'https://gitlab.com/oauth/token',
      });

      expect(get(inAuthPopup)).toBe(true);
    });

    it('should redirect to auth URL when no code is present', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue({
        realAuthURL: 'https://gitlab.com/oauth/authorize?params',
      });

      mockWindow.location.search = '';
      mockWindow.location.href = '';

      await handleClientSideAuthPopup({
        backendName: 'gitlab',
        clientId: 'test-client',
        tokenURL: 'https://gitlab.com/oauth/token',
      });

      expect(mockWindow.location.href).toBe('https://gitlab.com/oauth/authorize?params');
    });

    it('should do nothing when no auth data is stored', async () => {
      vi.mocked(LocalStorage.get).mockResolvedValue(null);

      mockWindow.location.search = '';

      await handleClientSideAuthPopup({
        backendName: 'gitlab',
        clientId: 'test-client',
        tokenURL: 'https://gitlab.com/oauth/token',
      });

      expect(get(inAuthPopup)).toBe(true);
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
      vi.mocked(siteConfig.subscribe).mockImplementation((fn) => {
        fn({
          backend: {
            name: 'github',
            site_domain: 'example.com',
          },
        });

        return () => {};
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
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({
          token: 'github-token',
          refreshToken: 'github-refresh-token',
        })}`,
        origin: 'https://github.com',
      });

      const result = await authPromise;

      expect(result).toEqual({
        token: 'github-token',
        refreshToken: 'github-refresh-token',
      });
    });

    it('should handle GitLab PKCE auth flow', async () => {
      mockWindow.open.mockReturnValue(mockPopup);
      vi.mocked(siteConfig.subscribe).mockImplementation((fn) => {
        fn({
          backend: {
            name: 'gitlab',
            site_domain: 'example.com',
            auth_type: 'pkce',
          },
        });

        return () => {};
      });

      const apiConfig = {
        clientId: 'gitlab-client-id',
        authScope: 'api',
        authURL: 'https://gitlab.com/oauth/authorize',
        tokenURL: 'https://gitlab.com/oauth/token',
      };

      const authPromise = handleAuthFlow({ auto: false, apiConfig });

      // Wait for LocalStorage operations
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect(LocalStorage.set).toHaveBeenCalledWith('sveltia-cms.auth', expect.any(Object));
      expect(LocalStorage.set).toHaveBeenCalledWith('sveltia-cms.user', { backendName: 'gitlab' });

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:gitlab',
        origin: 'https://localhost:3000',
      });

      messageHandler({
        data: `authorization:gitlab:success:${JSON.stringify({
          token: 'gitlab-token',
          refreshToken: 'gitlab-refresh-token',
        })}`,
        origin: 'https://localhost:3000',
      });

      const result = await authPromise;

      expect(result).toEqual({
        token: 'gitlab-token',
        refreshToken: 'gitlab-refresh-token',
      });
    });

    it('should handle Gitea PKCE auth flow', async () => {
      mockWindow.open.mockReturnValue(mockPopup);
      vi.mocked(siteConfig.subscribe).mockImplementation((_fn) => {
        _fn({
          backend: {
            name: 'gitea',
            site_domain: 'gitea.example.com',
          },
        });

        return () => {};
      });

      const apiConfig = {
        clientId: 'gitea-client-id',
        authScope: 'api',
        authURL: 'https://gitea.example.com/login/oauth/authorize',
        tokenURL: 'https://gitea.example.com/login/oauth/token',
      };

      const authPromise = handleAuthFlow({ auto: false, apiConfig });

      // Wait for LocalStorage operations
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      expect(LocalStorage.set).toHaveBeenCalledWith('sveltia-cms.auth', expect.any(Object));

      const messageHandler = mockWindow.addEventListener.mock.calls.find(
        ([event]) => event === 'message',
      )?.[1];

      messageHandler({
        data: 'authorizing:gitea',
        origin: 'https://localhost:3000',
      });

      messageHandler({
        data: `authorization:gitea:success:${JSON.stringify({
          token: 'gitea-token',
          refreshToken: 'gitea-refresh-token',
        })}`,
        origin: 'https://localhost:3000',
      });

      const result = await authPromise;

      expect(result).toEqual({
        token: 'gitea-token',
        refreshToken: 'gitea-refresh-token',
      });
    });

    it('should return undefined for automatic sign-in with Gitea PKCE', async () => {
      vi.mocked(siteConfig.subscribe).mockImplementation((fn) => {
        fn({
          backend: {
            name: 'gitea',
            site_domain: 'gitea.example.com',
          },
        });

        return () => {};
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
      vi.mocked(siteConfig.subscribe).mockImplementation((fn) => {
        fn({
          backend: {
            name: 'github',
            site_domain: 'example.com',
          },
        });

        return () => {};
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

    it('should return undefined when in auth popup for Gitea', async () => {
      mockWindow.opener = {
        origin: 'https://localhost:3000',
        postMessage: vi.fn(),
      };
      mockWindow.name = 'auth';

      vi.mocked(siteConfig.subscribe).mockImplementation((fn) => {
        fn({
          backend: {
            name: 'gitea',
            site_domain: 'gitea.example.com',
          },
        });

        return () => {};
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
      vi.mocked(siteConfig.subscribe).mockImplementation((fn) => {
        fn({
          backend: {
            name: 'github',
            site_domain: 'example.com',
          },
        });

        return () => {};
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
      });

      messageHandler({
        data: `authorization:github:success:${JSON.stringify({
          token: 'new-token',
          refreshToken: 'new-refresh-token',
        })}`,
        origin: 'https://github.com',
      });

      const result = await authPromise;

      expect(result).toEqual({
        token: 'new-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should return undefined for automatic sign-in without token', async () => {
      vi.mocked(siteConfig.subscribe).mockImplementation((fn) => {
        fn({
          backend: {
            name: 'github',
            site_domain: 'example.com',
          },
        });

        return () => {};
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
      vi.mocked(siteConfig.subscribe).mockImplementation((fn) => {
        fn({
          backend: {
            name: 'gitea',
            site_domain: 'gitea.example.com',
          },
        });

        return () => {};
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
});
