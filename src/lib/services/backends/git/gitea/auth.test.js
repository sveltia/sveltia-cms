// @vitest-environment jsdom

import { describe, expect, test, vi, beforeEach } from 'vitest';
import { BACKEND_NAME } from '$lib/services/backends/git/gitea/constants';
import { getUserProfile } from '$lib/services/backends/git/gitea/user';
import { apiConfig } from '$lib/services/backends/git/shared/api';
import {
  handleClientSideAuthPopup,
  initClientSideAuth,
} from '$lib/services/backends/git/shared/auth';
import { signIn, signOut } from './auth.js';

/**
 * @import { User } from '$lib/types/private.js'
 */

// Mock dependencies
vi.mock('$lib/services/backends/git/gitea/constants', () => ({
  BACKEND_NAME: 'gitea',
}));

vi.mock('$lib/services/backends/git/gitea/user', () => ({
  getUserProfile: vi.fn(),
}));

vi.mock('$lib/services/backends/git/shared/api', () => ({
  apiConfig: {
    clientId: 'test-client-id',
    authURL: 'https://gitea.example.com/oauth/authorize',
    tokenURL: 'https://gitea.example.com/oauth/token',
  },
}));

vi.mock('$lib/services/backends/git/shared/auth', () => ({
  handleClientSideAuthPopup: vi.fn(),
  initClientSideAuth: vi.fn(),
}));

// Mock global window object
Object.defineProperty(window, 'location', {
  value: {
    origin: 'https://cms.example.com',
  },
  writable: true,
});

Object.defineProperty(window, 'opener', {
  value: null,
  writable: true,
});

Object.defineProperty(window, 'name', {
  value: '',
  writable: true,
});

describe('Gitea Auth Service', () => {
  /** @type {User} */
  // @ts-ignore - Type compatibility in test
  const mockUser = {
    backendName: 'gitea',
    id: 123,
    name: 'Test User',
    login: 'testuser',
    email: 'test@example.com',
    avatarURL: 'https://gitea.example.com/avatar/123',
    profileURL: 'https://gitea.example.com/testuser',
    token: 'access-token',
    refreshToken: 'refresh-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset window properties
    window.opener = null;
    window.name = '';
  });

  describe('signIn', () => {
    test('should sign in with provided tokens', async () => {
      // @ts-ignore - Type issues in test
      const options = {
        token: 'existing-token',
        refreshToken: 'existing-refresh-token',
      };

      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      // @ts-ignore - Type issues in test
      const result = await signIn(options);

      expect(getUserProfile).toHaveBeenCalledWith({
        token: 'existing-token',
        refreshToken: 'existing-refresh-token',
      });
      expect(result).toEqual(mockUser);
    });

    test('should handle auth popup flow', async () => {
      window.opener = { origin: 'https://cms.example.com' };
      window.name = 'auth';

      // @ts-ignore - Type issues in test
      const options = {};

      vi.mocked(handleClientSideAuthPopup).mockResolvedValue();

      // @ts-ignore - Type issues in test
      const result = await signIn(options);

      expect(handleClientSideAuthPopup).toHaveBeenCalledWith({
        backendName: BACKEND_NAME,
        clientId: apiConfig.clientId,
        tokenURL: apiConfig.tokenURL,
      });
      expect(result).toBeUndefined();
    });

    test('should return undefined for auto sign-in without token', async () => {
      const options = { auto: true };
      // @ts-ignore - Type issues in test
      const result = await signIn(options);

      expect(result).toBeUndefined();
      expect(getUserProfile).not.toHaveBeenCalled();
    });

    test('should initiate client-side auth flow when no token provided', async () => {
      // @ts-ignore - Type issues in test
      const options = {};

      const mockTokens = {
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      };

      vi.mocked(initClientSideAuth).mockResolvedValue(mockTokens);
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      // @ts-ignore - Type issues in test
      const result = await signIn(options);

      expect(initClientSideAuth).toHaveBeenCalledWith({
        backendName: BACKEND_NAME,
        clientId: apiConfig.clientId,
        authURL: apiConfig.authURL,
        scope: 'read:repository,write:repository,read:user',
      });
      expect(getUserProfile).toHaveBeenCalledWith(mockTokens);
      expect(result).toEqual(mockUser);
    });

    test('should handle auth flow errors', async () => {
      // @ts-ignore - Type issues in test
      const options = {};
      const authError = new Error('Authentication failed');

      vi.mocked(initClientSideAuth).mockRejectedValue(authError);

      // @ts-ignore - Type issues in test
      await expect(signIn(options)).rejects.toThrow('Authentication failed');
    });

    test('should handle getUserProfile errors', async () => {
      // @ts-ignore - Type issues in test
      const options = {
        token: 'invalid-token',
        refreshToken: 'invalid-refresh-token',
      };

      const profileError = new Error('Invalid token');

      vi.mocked(getUserProfile).mockRejectedValue(profileError);

      // @ts-ignore - Type issues in test
      await expect(signIn(options)).rejects.toThrow('Invalid token');
    });

    test('should handle popup detection correctly', async () => {
      // Set up popup scenario
      window.opener = { origin: 'https://cms.example.com' };
      window.name = 'auth';

      // @ts-ignore - Type issues in test
      const options = {};

      vi.mocked(handleClientSideAuthPopup).mockResolvedValue();

      // @ts-ignore - Type issues in test
      const result = await signIn(options);

      expect(handleClientSideAuthPopup).toHaveBeenCalled();
      expect(initClientSideAuth).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    test('should not detect popup when origins do not match', async () => {
      window.opener = { origin: 'https://different-origin.com' };
      window.name = 'auth';

      // @ts-ignore - Type issues in test
      const options = {};

      const mockTokens = {
        token: 'new-token',
        refreshToken: 'new-refresh-token',
      };

      vi.mocked(initClientSideAuth).mockResolvedValue(mockTokens);
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      // @ts-ignore - Type issues in test
      const result = await signIn(options);

      expect(handleClientSideAuthPopup).not.toHaveBeenCalled();
      expect(initClientSideAuth).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    test('should not detect popup when window name is not auth', async () => {
      window.opener = { origin: 'https://cms.example.com' };
      window.name = 'regular-window';

      // @ts-ignore - Type issues in test
      const options = {};

      const mockTokens = {
        token: 'new-token',
        refreshToken: 'new-refresh-token',
      };

      vi.mocked(initClientSideAuth).mockResolvedValue(mockTokens);
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      // @ts-ignore - Type issues in test
      const result = await signIn(options);

      expect(handleClientSideAuthPopup).not.toHaveBeenCalled();
      expect(initClientSideAuth).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('signOut', () => {
    test('should resolve without error', async () => {
      await expect(signOut()).resolves.toBeUndefined();
    });
  });

  describe('auth configuration', () => {
    test('should use correct scope for Gitea', () => {
      const expectedScope = 'read:repository,write:repository,read:user';
      // This would be called during the sign-in flow
      // @ts-ignore - Type issues in test
      const options = {};

      vi.mocked(initClientSideAuth).mockResolvedValue({
        token: 'token',
        refreshToken: 'refresh',
      });
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      // @ts-ignore - Type issues in test
      signIn(options);

      expect(initClientSideAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: expectedScope,
        }),
      );
    });
  });
});
