import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getPatURL, signIn, signOut } from '$lib/services/backends/git/github/auth';
import { getUserProfile } from '$lib/services/backends/git/github/user';
import { getTokens } from '$lib/services/backends/git/shared/auth';

// Mock dependencies
vi.mock('$lib/services/backends/git/github/user');
vi.mock('$lib/services/backends/git/shared/auth');
vi.mock('$lib/services/backends/git/shared/api', () => ({
  apiConfig: { authURL: undefined },
}));

describe('GitHub auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPatURL', () => {
    test('returns correct GitHub Personal Access Token URL', () => {
      const repoURL = 'https://github.com/owner/repo';
      const result = getPatURL(repoURL);

      expect(result).toBe(
        'https://github.com/settings/personal-access-tokens/new?name=Sveltia+CMS&contents=write',
      );
    });

    test('handles GitHub Enterprise Server URLs', () => {
      const repoURL = 'https://github.enterprise.com/owner/repo';
      const result = getPatURL(repoURL);

      expect(result).toBe(
        'https://github.enterprise.com/settings/personal-access-tokens/new?name=Sveltia+CMS&contents=write',
      );
    });

    test('handles different repository paths', () => {
      const repoURL = 'https://github.com/different-owner/different-repo';
      const result = getPatURL(repoURL);

      expect(result).toBe(
        'https://github.com/settings/personal-access-tokens/new?name=Sveltia+CMS&contents=write',
      );
    });
  });

  describe('signIn', () => {
    test('returns undefined when getTokens returns undefined', async () => {
      vi.mocked(getTokens).mockResolvedValue(undefined);

      const result = await signIn({ auto: true });

      expect(result).toBeUndefined();
      expect(getUserProfile).not.toHaveBeenCalled();
    });

    test('signs in with token from getTokens', async () => {
      const mockUser = /** @type {any} */ ({
        id: '123',
        login: 'testuser',
        name: 'Test User',
        backendName: 'github',
      });

      vi.mocked(getTokens).mockResolvedValue({
        token: 'auth-token',
        refreshToken: 'refresh-token',
      });
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      const result = await signIn({ auto: false });

      expect(getTokens).toHaveBeenCalledWith({
        options: { auto: false },
        apiConfig: expect.any(Object),
      });
      expect(getUserProfile).toHaveBeenCalledWith({
        token: 'auth-token',
        refreshToken: 'refresh-token',
      });
      expect(result).toEqual(mockUser);
    });

    test('passes options to getTokens', async () => {
      vi.mocked(getTokens).mockResolvedValue(undefined);

      await signIn({ token: 'existing-token', auto: false });

      expect(getTokens).toHaveBeenCalledWith({
        options: { token: 'existing-token', auto: false },
        apiConfig: expect.any(Object),
      });
    });

    test('returns undefined when getTokens returns no token', async () => {
      vi.mocked(getTokens).mockResolvedValue(undefined);

      const result = await signIn({ auto: false });

      expect(result).toBeUndefined();
    });
  });

  describe('signOut', () => {
    test('returns undefined', async () => {
      const result = await signOut();

      expect(result).toBeUndefined();
    });
  });
});
