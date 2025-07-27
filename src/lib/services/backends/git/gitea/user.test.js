import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { getUserProfile } from './user.js';

/**
 * @import { AuthTokens } from '$lib/types/private';
 */

// Mock dependencies with vi.hoisted to ensure proper hoisting
const getMock = vi.hoisted(() => vi.fn());
const fetchAPIMock = vi.hoisted(() => vi.fn());

vi.mock('svelte/store', () => ({
  get: getMock,
}));

vi.mock('$lib/services/backends/git/gitea/constants', () => ({
  BACKEND_NAME: 'gitea',
}));

vi.mock('$lib/services/backends/git/shared/api', () => ({
  fetchAPI: fetchAPIMock,
}));

vi.mock('$lib/services/user', () => ({
  user: { mockStore: 'user' },
}));

describe('Gitea User Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for user store
    getMock.mockImplementation((/** @type {any} */ store) => {
      if (store && typeof store === 'object' && store.mockStore === 'user') {
        return null; // Default: no user logged in
      }

      return {};
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserProfile', () => {
    test('should fetch user profile successfully', async () => {
      const mockTokens = /** @type {AuthTokens} */ ({
        token: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });

      const mockApiResponse = {
        id: 12345,
        full_name: 'John Doe',
        login: 'johndoe',
        email: 'john.doe@example.com',
        avatar_url: 'https://gitea.example.com/avatars/johndoe.jpg',
        html_url: 'https://gitea.example.com/johndoe',
      };

      fetchAPIMock.mockResolvedValue(mockApiResponse);

      const result = await getUserProfile(mockTokens);

      expect(fetchAPIMock).toHaveBeenCalledWith('/user', {
        token: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });

      expect(result).toEqual({
        backendName: 'gitea',
        id: 12345,
        name: 'John Doe',
        login: 'johndoe',
        email: 'john.doe@example.com',
        avatarURL: 'https://gitea.example.com/avatars/johndoe.jpg',
        profileURL: 'https://gitea.example.com/johndoe',
        token: 'test-access-token',
        refreshToken: 'test-refresh-token',
      });
    });

    test('should handle token renewal during fetch', async () => {
      const mockTokens = /** @type {AuthTokens} */ ({
        token: 'old-access-token',
        refreshToken: 'old-refresh-token',
      });

      const mockApiResponse = {
        id: 67890,
        full_name: 'Jane Smith',
        login: 'janesmith',
        email: 'jane.smith@example.com',
        avatar_url: 'https://gitea.example.com/avatars/janesmith.jpg',
        html_url: 'https://gitea.example.com/janesmith',
      };

      // Mock user store returning updated tokens
      getMock.mockImplementation((/** @type {any} */ store) => {
        if (store && typeof store === 'object' && store.mockStore === 'user') {
          return {
            token: 'new-access-token',
            refreshToken: 'new-refresh-token',
          };
        }

        return {};
      });

      fetchAPIMock.mockResolvedValue(mockApiResponse);

      const result = await getUserProfile(mockTokens);

      expect(fetchAPIMock).toHaveBeenCalledWith('/user', {
        token: 'old-access-token',
        refreshToken: 'old-refresh-token',
      });

      // Should return the updated tokens from the user store
      expect(result).toEqual({
        backendName: 'gitea',
        id: 67890,
        name: 'Jane Smith',
        login: 'janesmith',
        email: 'jane.smith@example.com',
        avatarURL: 'https://gitea.example.com/avatars/janesmith.jpg',
        profileURL: 'https://gitea.example.com/janesmith',
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    test('should use original tokens when user store tokens are unchanged', async () => {
      const mockTokens = /** @type {AuthTokens} */ ({
        token: 'same-access-token',
        refreshToken: 'same-refresh-token',
      });

      const mockApiResponse = {
        id: 11111,
        full_name: 'Bob Wilson',
        login: 'bobwilson',
        email: 'bob.wilson@example.com',
        avatar_url: 'https://gitea.example.com/avatars/bobwilson.jpg',
        html_url: 'https://gitea.example.com/bobwilson',
      };

      // Mock user store returning same tokens
      getMock.mockImplementation((/** @type {any} */ store) => {
        if (store && typeof store === 'object' && store.mockStore === 'user') {
          return {
            token: 'same-access-token',
            refreshToken: 'same-refresh-token',
          };
        }

        return {};
      });

      fetchAPIMock.mockResolvedValue(mockApiResponse);

      const result = await getUserProfile(mockTokens);

      expect(result.token).toBe('same-access-token');
      expect(result.refreshToken).toBe('same-refresh-token');
    });

    test('should handle missing optional fields in API response', async () => {
      const mockTokens = /** @type {AuthTokens} */ ({
        token: 'test-token',
        refreshToken: 'test-refresh',
      });

      const mockApiResponse = {
        id: 99999,
        full_name: '',
        login: 'minimal_user',
        email: '',
        avatar_url: '',
        html_url: 'https://gitea.example.com/minimal_user',
      };

      fetchAPIMock.mockResolvedValue(mockApiResponse);

      const result = await getUserProfile(mockTokens);

      expect(result).toEqual({
        backendName: 'gitea',
        id: 99999,
        name: '',
        login: 'minimal_user',
        email: '',
        avatarURL: '',
        profileURL: 'https://gitea.example.com/minimal_user',
        token: 'test-token',
        refreshToken: 'test-refresh',
      });
    });

    test('should handle API fetch errors', async () => {
      const mockTokens = /** @type {AuthTokens} */ ({
        token: 'invalid-token',
        refreshToken: 'invalid-refresh',
      });

      const mockError = new Error('Unauthorized');

      fetchAPIMock.mockRejectedValue(mockError);

      await expect(getUserProfile(mockTokens)).rejects.toThrow('Unauthorized');

      expect(fetchAPIMock).toHaveBeenCalledWith('/user', {
        token: 'invalid-token',
        refreshToken: 'invalid-refresh',
      });
    });

    test('should handle user store returning null', async () => {
      const mockTokens = /** @type {AuthTokens} */ ({
        token: 'test-token',
        refreshToken: 'test-refresh',
      });

      const mockApiResponse = {
        id: 55555,
        full_name: 'Test User',
        login: 'testuser',
        email: 'test@example.com',
        avatar_url: 'https://gitea.example.com/avatars/testuser.jpg',
        html_url: 'https://gitea.example.com/testuser',
      };

      // User store returns null (no logged in user)
      getMock.mockImplementation((/** @type {any} */ store) => {
        if (store && typeof store === 'object' && store.mockStore === 'user') {
          return null;
        }

        return {};
      });

      fetchAPIMock.mockResolvedValue(mockApiResponse);

      const result = await getUserProfile(mockTokens);

      // Should use original tokens when user store is null
      expect(result.token).toBe('test-token');
      expect(result.refreshToken).toBe('test-refresh');
    });

    test('should handle user store returning user without token', async () => {
      const mockTokens = /** @type {AuthTokens} */ ({
        token: 'original-token',
        refreshToken: 'original-refresh',
      });

      const mockApiResponse = {
        id: 77777,
        full_name: 'Another User',
        login: 'anotheruser',
        email: 'another@example.com',
        avatar_url: 'https://gitea.example.com/avatars/anotheruser.jpg',
        html_url: 'https://gitea.example.com/anotheruser',
      };

      // User store returns user object but without token property
      getMock.mockImplementation((/** @type {any} */ store) => {
        if (store && typeof store === 'object' && store.mockStore === 'user') {
          return {
            name: 'Some User',
            // No token property
          };
        }

        return {};
      });

      fetchAPIMock.mockResolvedValue(mockApiResponse);

      const result = await getUserProfile(mockTokens);

      // Should use original tokens when user store doesn't have token
      expect(result.token).toBe('original-token');
      expect(result.refreshToken).toBe('original-refresh');
    });

    test('should handle numeric values correctly', async () => {
      const mockTokens = /** @type {AuthTokens} */ ({
        token: 'numeric-test-token',
        refreshToken: 'numeric-test-refresh',
      });

      const mockApiResponse = {
        id: 2147483647, // Large integer
        full_name: 'Numeric User',
        login: 'numericuser',
        email: 'numeric@example.com',
        avatar_url: 'https://gitea.example.com/avatars/numericuser.jpg',
        html_url: 'https://gitea.example.com/numericuser',
      };

      fetchAPIMock.mockResolvedValue(mockApiResponse);

      const result = await getUserProfile(mockTokens);

      expect(result.id).toBe(2147483647);
      expect(typeof result.id).toBe('number');
    });

    test('should map all API response fields correctly', async () => {
      const mockTokens = /** @type {AuthTokens} */ ({
        token: 'mapping-test-token',
        refreshToken: 'mapping-test-refresh',
      });

      const mockApiResponse = {
        id: 123456,
        full_name: 'Full Name Test',
        login: 'logintest',
        email: 'login@test.com',
        avatar_url: 'https://example.com/avatar.png',
        html_url: 'https://example.com/profile',
        // Additional fields that should be ignored
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-06-01T00:00:00Z',
        is_admin: false,
      };

      fetchAPIMock.mockResolvedValue(mockApiResponse);

      const result = await getUserProfile(mockTokens);

      // Verify correct field mapping
      expect(result.id).toBe(mockApiResponse.id);
      expect(result.name).toBe(mockApiResponse.full_name);
      expect(result.login).toBe(mockApiResponse.login);
      expect(result.email).toBe(mockApiResponse.email);
      expect(result.avatarURL).toBe(mockApiResponse.avatar_url);
      expect(result.profileURL).toBe(mockApiResponse.html_url);

      // Verify additional fields are not included
      expect(result).not.toHaveProperty('created_at');
      expect(result).not.toHaveProperty('updated_at');
      expect(result).not.toHaveProperty('is_admin');
    });
  });
});
