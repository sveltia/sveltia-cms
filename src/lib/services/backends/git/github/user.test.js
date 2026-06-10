import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getUserProfile } from '$lib/services/backends/git/github/user';
import { fetchAPI } from '$lib/services/backends/git/shared/api';

// Mock dependencies
vi.mock('$lib/services/backends/git/shared/api');

const mockUserState = vi.hoisted(() => ({ account: /** @type {any} */ (null) }));

vi.mock('$lib/services/user/account.svelte', () => ({
  user: mockUserState,
}));

describe('GitHub user service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no user logged in
    mockUserState.account = null;
  });

  describe('getUserProfile', () => {
    test('fetches user profile successfully', async () => {
      const mockResponse = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        html_url: 'https://github.com/testuser',
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await getUserProfile({ token: 'test-token', refreshToken: 'test-refresh' });

      expect(fetchAPI).toHaveBeenCalledWith('/user', {
        token: 'test-token',
        refreshToken: 'test-refresh',
      });
      expect(result).toEqual({
        backendName: 'github',
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatarURL: 'https://avatars.githubusercontent.com/u/12345',
        profileURL: 'https://github.com/testuser',
        bot: false,
        token: 'test-token',
        refreshToken: 'test-refresh',
      });
    });

    test('handles user profile without email', async () => {
      const mockUserData = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: null,
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        html_url: 'https://github.com/testuser',
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockUserData);

      const result = await getUserProfile({ token: 'test-token' });

      expect(result.email).toBeNull();
    });

    test('handles user profile without name', async () => {
      const mockUserData = {
        id: 12345,
        login: 'testuser',
        name: null,
        email: 'test@example.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        html_url: 'https://github.com/testuser',
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockUserData);

      const result = await getUserProfile({ token: 'test-token' });

      expect(result.name).toBeNull();
    });

    test('throws error on API failure', async () => {
      const error = new Error('API Error');

      vi.mocked(fetchAPI).mockRejectedValue(error);

      await expect(getUserProfile({ token: 'invalid-token' })).rejects.toThrow('API Error');
    });

    test('handles token renewal during user profile fetch', async () => {
      const mockUserResponse = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        html_url: 'https://github.com/testuser',
      };

      // Mock the user store to return updated tokens
      mockUserState.account = /** @type {any} */ ({
        token: 'new-access-token', // Renewed token
        refreshToken: 'new-refresh-token',
      });

      vi.mocked(fetchAPI).mockResolvedValue(mockUserResponse);

      const result = await getUserProfile({
        token: 'old-access-token',
        refreshToken: 'old-refresh-token',
      });

      expect(result).toEqual({
        backendName: 'github',
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatarURL: 'https://avatars.githubusercontent.com/u/12345',
        profileURL: 'https://github.com/testuser',
        bot: false,
        token: 'new-access-token', // Should use the renewed token
        refreshToken: 'new-refresh-token',
      });
    });
  });
});
