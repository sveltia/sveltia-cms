import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getUserProfile } from '$lib/services/backends/git/gitlab/user';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { user } from '$lib/services/user';

// Mock dependencies
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/user', () => ({
  user: { subscribe: vi.fn() },
}));
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() })),
  derived: vi.fn(() => ({ subscribe: vi.fn() })),
  readonly: vi.fn(() => ({ subscribe: vi.fn() })),
}));

describe('GitLab user service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock get function to return null initially
    vi.mocked(get).mockReturnValue(null);
  });

  describe('getUserProfile', () => {
    test('fetches user profile successfully', async () => {
      const mockResponse = {
        id: 123,
        name: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        avatar_url: 'https://example.com/avatar.jpg',
        web_url: 'https://gitlab.com/testuser',
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockResponse);

      const result = await getUserProfile({ token: 'test-token', refreshToken: 'refresh-token' });

      expect(fetchAPI).toHaveBeenCalledWith('/user', {
        token: 'test-token',
        refreshToken: 'refresh-token',
      });
      expect(result).toEqual({
        backendName: 'gitlab',
        id: 123,
        name: 'Test User',
        login: 'testuser',
        email: 'test@example.com',
        avatarURL: 'https://example.com/avatar.jpg',
        profileURL: 'https://gitlab.com/testuser',
        token: 'test-token',
        refreshToken: 'refresh-token',
      });
    });

    test('fetches user profile with refresh token', async () => {
      const mockUserResponse = {
        id: 456,
        name: 'Another User',
        username: 'anotheruser',
        email: 'another@example.com',
        avatar_url: 'https://gitlab.com/avatar2.jpg',
        web_url: 'https://gitlab.com/anotheruser',
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockUserResponse);

      const result = await getUserProfile({
        token: 'test-token',
        refreshToken: 'refresh-token',
      });

      expect(fetchAPI).toHaveBeenCalledWith('/user', {
        token: 'test-token',
        refreshToken: 'refresh-token',
      });

      expect(result).toEqual({
        backendName: 'gitlab',
        id: 456,
        name: 'Another User',
        login: 'anotheruser',
        email: 'another@example.com',
        avatarURL: 'https://gitlab.com/avatar2.jpg',
        profileURL: 'https://gitlab.com/anotheruser',
        token: 'test-token',
        refreshToken: 'refresh-token',
      });
    });

    test('handles API error', async () => {
      const error = new Error('API Error');

      vi.mocked(fetchAPI).mockRejectedValue(error);

      await expect(getUserProfile({ token: 'invalid-token' })).rejects.toThrow('API Error');

      expect(fetchAPI).toHaveBeenCalledWith('/user', {
        token: 'invalid-token',
        refreshToken: undefined,
      });
    });

    test('handles user profile with missing optional fields', async () => {
      const mockUserResponse = {
        id: 789,
        name: 'Basic User',
        username: 'basicuser',
        // Missing email, avatar_url, web_url
      };

      vi.mocked(fetchAPI).mockResolvedValue(mockUserResponse);

      const result = await getUserProfile({ token: 'test-token' });

      expect(result).toEqual({
        backendName: 'gitlab',
        id: 789,
        name: 'Basic User',
        login: 'basicuser',
        email: undefined,
        avatarURL: undefined,
        profileURL: undefined,
        token: 'test-token',
        refreshToken: undefined,
      });
    });

    test('handles token renewal during user profile fetch', async () => {
      const mockUserResponse = {
        id: 123,
        name: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
      };

      // Mock the user store to return updated tokens
      vi.mocked(get).mockImplementation((store) => {
        if (store === user) {
          return {
            token: 'new-access-token', // Renewed token
            refreshToken: 'new-refresh-token',
          };
        }

        return null;
      });

      vi.mocked(fetchAPI).mockResolvedValue(mockUserResponse);

      const result = await getUserProfile({
        token: 'old-access-token',
        refreshToken: 'old-refresh-token',
      });

      expect(result).toEqual({
        backendName: 'gitlab',
        id: 123,
        name: 'Test User',
        login: 'testuser',
        email: 'test@example.com',
        avatarURL: undefined, // No avatar_url in mock response
        profileURL: undefined, // No web_url in mock response
        token: 'new-access-token', // Should use the renewed token
        refreshToken: 'new-refresh-token',
      });
    });
  });
});
