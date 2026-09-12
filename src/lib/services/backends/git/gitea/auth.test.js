import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getUserProfile } from '$lib/services/backends/git/gitea/user';
import { signInToBackend } from '$lib/services/backends/git/shared/auth';

import { getTokenPageURL, signIn, signOut } from './auth.js';

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
  signInToBackend: vi.fn(),
  signOut: vi.fn(async () => undefined),
}));

describe('Gitea Auth Service', () => {
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
    test('delegates to the shared sign-in with the backend’s user profile fetcher', async () => {
      const mockUser = /** @type {any} */ ({
        id: 123,
        login: 'testuser',
        name: 'Test User',
        backendName: 'gitea',
      });

      vi.mocked(signInToBackend).mockResolvedValue(mockUser);

      const options = { token: 'existing-token', auto: false };
      const result = await signIn(options);

      expect(signInToBackend).toHaveBeenCalledWith({ options, getUserProfile });
      expect(result).toEqual(mockUser);
    });

    test('returns undefined when the shared sign-in returns undefined', async () => {
      vi.mocked(signInToBackend).mockResolvedValue(undefined);

      const result = await signIn({ auto: true });

      expect(result).toBeUndefined();
    });
  });

  describe('signOut', () => {
    test('re-exports the shared sign-out', async () => {
      await expect(signOut()).resolves.toBeUndefined();
    });
  });
});
