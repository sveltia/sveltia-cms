import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getTokenPageURL, signIn, signOut } from '$lib/services/backends/git/gitlab/auth';
import { getUserProfile } from '$lib/services/backends/git/gitlab/user';
import { getTokens } from '$lib/services/backends/git/shared/auth';

// Mock dependencies
vi.mock('$lib/services/backends/git/gitlab/user');
vi.mock('$lib/services/backends/git/shared/auth');
vi.mock('$lib/services/backends/git/shared/api', () => ({
  apiConfig: {
    clientId: 'test-client-id',
    authURL: 'https://gitlab.com/oauth/authorize',
    tokenURL: 'https://gitlab.com/oauth/token',
  },
}));

describe('GitLab auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window object
    Object.defineProperty(global, 'window', {
      value: {
        opener: null,
        location: { origin: 'http://localhost' },
        name: '',
      },
      writable: true,
    });
  });

  describe('getTokenPageURL', () => {
    test('returns correct GitLab Personal Access Token URL', () => {
      const repoURL = 'https://gitlab.com/owner/repo';
      const result = getTokenPageURL(repoURL);

      expect(result).toBe(
        'https://gitlab.com/-/user_settings/personal_access_tokens?name=Sveltia+CMS&scopes=api%2Cread_user',
      );
    });

    test('handles GitLab self-hosted instance URLs', () => {
      const repoURL = 'https://gitlab.example.com/owner/repo';
      const result = getTokenPageURL(repoURL);

      expect(result).toBe(
        'https://gitlab.example.com/-/user_settings/personal_access_tokens?name=Sveltia+CMS&scopes=api%2Cread_user',
      );
    });

    test('handles different repository paths', () => {
      const repoURL = 'https://gitlab.com/group/subgroup/project';
      const result = getTokenPageURL(repoURL);

      expect(result).toBe(
        'https://gitlab.com/-/user_settings/personal_access_tokens?name=Sveltia+CMS&scopes=api%2Cread_user',
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
        id: 123,
        username: 'testuser',
        name: 'Test User',
        backendName: 'gitlab',
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
