import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getTokenPageURL, signIn, signOut } from '$lib/services/backends/git/gitlab/auth';
import { getUserProfile } from '$lib/services/backends/git/gitlab/user';
import { signInToBackend } from '$lib/services/backends/git/shared/auth';

// Mock dependencies
vi.mock('$lib/services/backends/git/gitlab/user');
vi.mock('$lib/services/backends/git/shared/auth', () => ({
  signInToBackend: vi.fn(),
  signOut: vi.fn(async () => undefined),
}));
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
    const query = 'name=Sveltia+CMS&scopes=api%2Cread_user';

    test('returns correct GitLab Personal Access Token URL', () => {
      expect(getTokenPageURL('https://gitlab.com')).toBe(
        `https://gitlab.com/-/user_settings/personal_access_tokens?${query}`,
      );
    });

    test('handles GitLab self-hosted instance URLs', () => {
      expect(getTokenPageURL('https://gitlab.example.com')).toBe(
        `https://gitlab.example.com/-/user_settings/personal_access_tokens?${query}`,
      );
    });

    test('keeps the subpath of a self-hosted instance', () => {
      expect(getTokenPageURL('https://example.com/gitlab')).toBe(
        `https://example.com/gitlab/-/user_settings/personal_access_tokens?${query}`,
      );
    });
  });

  describe('signIn', () => {
    test('delegates to the shared sign-in with the backend’s user profile fetcher', async () => {
      const mockUser = /** @type {any} */ ({
        id: 123,
        username: 'testuser',
        name: 'Test User',
        backendName: 'gitlab',
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
