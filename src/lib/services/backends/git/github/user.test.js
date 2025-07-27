import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getUserProfile } from '$lib/services/backends/git/github/user';
import { fetchAPI } from '$lib/services/backends/git/shared/api';

// Mock dependencies
vi.mock('$lib/services/backends/git/shared/api');

describe('GitHub user service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserProfile', () => {
    test('fetches user profile successfully', async () => {
      const mockUserData = {
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatar_url: 'https://avatars.githubusercontent.com/u/12345',
        html_url: 'https://github.com/testuser',
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockUserData);

      const result = await getUserProfile({ token: 'test-token' });

      expect(fetchAPI).toHaveBeenCalledWith('/user', {
        token: 'test-token',
      });
      expect(result).toEqual({
        backendName: 'github',
        id: 12345,
        login: 'testuser',
        name: 'Test User',
        email: 'test@example.com',
        avatarURL: 'https://avatars.githubusercontent.com/u/12345',
        profileURL: 'https://github.com/testuser',
        token: 'test-token',
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
  });
});
