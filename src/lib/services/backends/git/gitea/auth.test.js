import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getUserProfile } from '$lib/services/backends/git/gitea/user';
import { getTokens } from '$lib/services/backends/git/shared/auth';

import { getTokenPageURL, signIn, signOut } from './auth.js';

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
  getTokens: vi.fn(),
}));

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
  });

  describe('getTokenPageURL', () => {
    test('returns correct Gitea Personal Access Token URL', () => {
      const repoURL = 'https://gitea.com/owner/repo';
      const result = getTokenPageURL(repoURL);

      expect(result).toBe('https://gitea.com/user/settings/applications');
    });

    test('handles Forgejo instance URLs', () => {
      const repoURL = 'https://codeberg.org/owner/repo';
      const result = getTokenPageURL(repoURL);

      expect(result).toBe('https://codeberg.org/user/settings/applications');
    });

    test('handles self-hosted Gitea instance URLs', () => {
      const repoURL = 'https://git.example.com/owner/repo';
      const result = getTokenPageURL(repoURL);

      expect(result).toBe('https://git.example.com/user/settings/applications');
    });

    test('handles different repository paths', () => {
      const repoURL = 'https://gitea.example.com/different-owner/different-repo';
      const result = getTokenPageURL(repoURL);

      expect(result).toBe('https://gitea.example.com/user/settings/applications');
    });

    test('handles URLs with ports', () => {
      const repoURL = 'https://gitea.example.com:3000/owner/repo';
      const result = getTokenPageURL(repoURL);

      expect(result).toBe('https://gitea.example.com:3000/user/settings/applications');
    });
  });

  describe('signIn', () => {
    test('should return undefined when getTokens returns undefined', async () => {
      vi.mocked(getTokens).mockResolvedValue(undefined);

      // @ts-ignore - Type issues in test
      const result = await signIn({});

      expect(result).toBeUndefined();
      expect(getUserProfile).not.toHaveBeenCalled();
    });

    test('should sign in with tokens from getTokens', async () => {
      vi.mocked(getTokens).mockResolvedValue({
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      // @ts-ignore - Type issues in test
      const result = await signIn({});

      expect(getTokens).toHaveBeenCalledWith({
        options: {},
        apiConfig: expect.any(Object),
      });
      expect(getUserProfile).toHaveBeenCalledWith({
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      expect(result).toEqual(mockUser);
    });

    test('should pass options to getTokens', async () => {
      vi.mocked(getTokens).mockResolvedValue({
        token: 'auth-token',
        refreshToken: 'refresh-token',
      });
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      const options = {
        token: 'existing-token',
        refreshToken: 'existing-refresh-token',
        auto: false,
      };

      // @ts-ignore - Type issues in test
      await signIn(options);

      expect(getTokens).toHaveBeenCalledWith({
        options,
        apiConfig: expect.any(Object),
      });
    });

    test('should return undefined for auto sign-in without token', async () => {
      vi.mocked(getTokens).mockResolvedValue(undefined);

      const options = { auto: true };
      // @ts-ignore - Type issues in test
      const result = await signIn(options);

      expect(result).toBeUndefined();
      expect(getUserProfile).not.toHaveBeenCalled();
    });

    test('should handle getTokens errors', async () => {
      const authError = new Error('Authentication failed');

      vi.mocked(getTokens).mockRejectedValue(authError);

      // @ts-ignore - Type issues in test
      await expect(signIn({})).rejects.toThrow('Authentication failed');
    });

    test('should handle getUserProfile errors', async () => {
      vi.mocked(getTokens).mockResolvedValue({
        token: 'auth-token',
        refreshToken: 'refresh-token',
      });

      const profileError = new Error('Invalid token');

      vi.mocked(getUserProfile).mockRejectedValue(profileError);

      // @ts-ignore - Type issues in test
      await expect(signIn({})).rejects.toThrow('Invalid token');
    });
  });

  describe('signOut', () => {
    test('should resolve without error', async () => {
      await expect(signOut()).resolves.toBeUndefined();
    });
  });
});
