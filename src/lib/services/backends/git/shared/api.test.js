import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { refreshAccessToken, apiConfig, graphqlVars } from './api';

// Mock svelte-i18n
vi.mock('svelte-i18n', () => ({
  _: vi.fn(() => 'Token refresh failed'), // Return a readable store value directly
}));

// Mock svelte/store
vi.mock('svelte/store', () => ({
  get: vi.fn((value) => value), // get() should just return the value passed to it
}));

// Mock user store
vi.mock('$lib/services/user', () => ({
  user: {
    update: vi.fn(),
  },
}));

// Mock networking utils
vi.mock('$lib/services/utils/networking', () => ({
  sendRequest: vi.fn(),
}));

// Mock global fetch
global.fetch = vi.fn();

describe('api.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('apiConfig', () => {
    it('should be defined as an object', () => {
      expect(apiConfig).toBeDefined();
      expect(typeof apiConfig).toBe('object');
    });

    it('should have expected properties', () => {
      expect(apiConfig).toHaveProperty('clientId');
      expect(apiConfig).toHaveProperty('authURL');
      expect(apiConfig).toHaveProperty('tokenURL');
      expect(apiConfig).toHaveProperty('authScheme');
      expect(apiConfig).toHaveProperty('origin');
      expect(apiConfig).toHaveProperty('restBaseURL');
      expect(apiConfig).toHaveProperty('graphqlBaseURL');
    });

    it('should have empty string defaults', () => {
      expect(apiConfig.clientId).toBe('');
      expect(apiConfig.authURL).toBe('');
      expect(apiConfig.tokenURL).toBe('');
      expect(apiConfig.origin).toBe('');
      expect(apiConfig.restBaseURL).toBe('');
      expect(apiConfig.graphqlBaseURL).toBe('');
    });

    it('should have token auth scheme as default', () => {
      expect(apiConfig.authScheme).toBe('token');
    });
  });

  describe('graphqlVars', () => {
    it('should be defined as an empty object', () => {
      expect(graphqlVars).toBeDefined();
      expect(typeof graphqlVars).toBe('object');
      expect(Object.keys(graphqlVars)).toHaveLength(0);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        }),
        { status: 200, statusText: 'OK' },
      );

      vi.mocked(fetch).mockResolvedValue(mockResponse);

      const result = await refreshAccessToken({
        clientId: 'test-client-id',
        tokenURL: 'https://api.github.com/oauth/token',
        refreshToken: 'old-refresh-token',
      });

      expect(fetch).toHaveBeenCalledWith('https://api.github.com/oauth/token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: 'test-client-id',
          refresh_token: 'old-refresh-token',
        }),
      });

      expect(result).toEqual({
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('should handle fetch error', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      await expect(
        refreshAccessToken({
          clientId: 'test-client-id',
          tokenURL: 'https://api.github.com/oauth/token',
          refreshToken: 'old-refresh-token',
        }),
      ).rejects.toThrow('Token refresh failed');
    });

    it('should handle non-ok response', async () => {
      const mockResponse = new Response('', { status: 401, statusText: 'Unauthorized' });

      vi.mocked(fetch).mockResolvedValue(mockResponse);

      await expect(
        refreshAccessToken({
          clientId: 'test-client-id',
          tokenURL: 'https://api.github.com/oauth/token',
          refreshToken: 'old-refresh-token',
        }),
      ).rejects.toThrow('Token refresh failed');
    });
  });

  describe('fetchAPI', () => {
    it('should be available as an export', async () => {
      const { fetchAPI } = await import('./api');

      expect(typeof fetchAPI).toBe('function');
    });
  });

  describe('fetchGraphQL', () => {
    it('should be available as an export', async () => {
      const { fetchGraphQL } = await import('./api');

      expect(typeof fetchGraphQL).toBe('function');
    });
  });
});
