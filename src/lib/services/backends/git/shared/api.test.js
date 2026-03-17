import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiConfig, graphqlVars, refreshAccessToken } from './api';
import * as apiModule from './api';

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

  describe('Exported functions', () => {
    it('should export all required functions', async () => {
      expect(typeof apiModule.fetchAPI).toBe('function');
      expect(typeof apiModule.fetchGraphQL).toBe('function');
      expect(typeof apiModule.refreshAccessToken).toBe('function');
    });
  });

  describe('apiConfig', () => {
    it('should be defined as an object', () => {
      expect(apiConfig).toBeDefined();
      expect(typeof apiConfig).toBe('object');
    });

    it('should have expected properties', () => {
      expect(apiConfig).toHaveProperty('clientId');
      expect(apiConfig).toHaveProperty('authScope');
      expect(apiConfig).toHaveProperty('authURL');
      expect(apiConfig).toHaveProperty('tokenURL');
      expect(apiConfig).toHaveProperty('authScheme');
      expect(apiConfig).toHaveProperty('restBaseURL');
      expect(apiConfig).toHaveProperty('graphqlBaseURL');
    });

    it('should have empty string defaults', () => {
      expect(apiConfig.clientId).toBe('');
      expect(apiConfig.authScope).toBe('');
      expect(apiConfig.authURL).toBe('');
      expect(apiConfig.tokenURL).toBe('');
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

    it('should update user store when refreshing token successfully', async () => {
      const { user } = await import('$lib/services/user');

      const mockResponse = new Response(
        JSON.stringify({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        }),
        { status: 200, statusText: 'OK' },
      );

      vi.mocked(fetch).mockResolvedValue(mockResponse);

      await refreshAccessToken({
        clientId: 'test-client-id',
        tokenURL: 'https://api.github.com/oauth/token',
        refreshToken: 'old-refresh-token',
      });

      expect(user.update).toHaveBeenCalled();

      // Get the callback function and test it
      const updateCallback = vi.mocked(user.update).mock.calls[0]?.[0];

      if (updateCallback) {
        // Test the callback with an existing user (use type assertion to bypass type checking)
        const existingUser = /** @type {any} */ ({
          token: 'old-token',
          refreshToken: 'old-refresh',
        });

        const result = updateCallback(existingUser);

        expect(result).toEqual({
          token: 'new-access-token',
          refreshToken: 'new-refresh-token',
        });
      }
    });

    it('should update user store callback with null user', async () => {
      const { user } = await import('$lib/services/user');

      const mockResponse = new Response(
        JSON.stringify({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
        }),
        { status: 200, statusText: 'OK' },
      );

      vi.mocked(fetch).mockResolvedValue(mockResponse);

      await refreshAccessToken({
        clientId: 'test-client-id',
        tokenURL: 'https://api.github.com/oauth/token',
        refreshToken: 'old-refresh-token',
      });

      // Get the callback and test with null user
      const updateCallback = vi.mocked(user.update).mock.calls[0]?.[0];

      if (updateCallback) {
        const result = updateCallback(null);

        expect(result).toBeNull();
      }
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
    beforeEach(() => {
      // Set up API config for tests
      Object.assign(apiConfig, {
        clientId: 'test-client-id',
        tokenURL: 'https://api.github.com/oauth/token',
        restBaseURL: 'https://api.github.com',
        graphqlBaseURL: 'https://api.github.com/graphql',
        authScheme: 'token',
      });
    });

    it('should be available as an export', async () => {
      const { fetchAPI } = await import('./api');

      expect(typeof fetchAPI).toBe('function');
    });

    it('should use REST base URL when isGraphQL is false', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const mockUser = { token: 'test-token', refreshToken: 'test-refresh-token' };
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue(mockUser);

      vi.mocked(sendRequest).mockResolvedValue({ success: true });

      await fetchAPI('/test-endpoint', { isGraphQL: false });

      expect(sendRequest).toHaveBeenCalledWith(
        'https://api.github.com/test-endpoint',
        {
          method: 'GET',
          headers: { Authorization: 'token test-token' },
          body: null,
        },
        {
          responseType: 'json',
          refreshAccessToken: expect.any(Function),
        },
      );
    });

    it('should use GraphQL base URL when isGraphQL is true', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const mockUser = { token: 'test-token', refreshToken: 'test-refresh-token' };
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue(mockUser);

      vi.mocked(sendRequest).mockResolvedValue({ success: true });

      await fetchAPI('/test-endpoint', { isGraphQL: true });

      expect(sendRequest).toHaveBeenCalledWith(
        'https://api.github.com/graphql/test-endpoint',
        {
          method: 'GET',
          headers: { Authorization: 'token test-token' },
          body: null,
        },
        {
          responseType: 'json',
          refreshAccessToken: expect.any(Function),
        },
      );
    });

    it('should default to REST base URL when isGraphQL is not specified', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const mockUser = { token: 'test-token', refreshToken: 'test-refresh-token' };
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue(mockUser);

      vi.mocked(sendRequest).mockResolvedValue({ success: true });

      await fetchAPI('/test-endpoint');

      expect(sendRequest).toHaveBeenCalledWith(
        'https://api.github.com/test-endpoint',
        {
          method: 'GET',
          headers: { Authorization: 'token test-token' },
          body: null,
        },
        {
          responseType: 'json',
          refreshAccessToken: expect.any(Function),
        },
      );
    });

    it('should combine isGraphQL with other options correctly', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const mockUser = { token: 'test-token', refreshToken: 'test-refresh-token' };
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue(mockUser);

      vi.mocked(sendRequest).mockResolvedValue({ success: true });

      const requestBody = { query: 'test query' };
      const customHeaders = { 'X-Custom-Header': 'custom-value' };

      await fetchAPI('/graphql', {
        method: 'POST',
        headers: customHeaders,
        body: requestBody,
        isGraphQL: true,
        responseType: 'text',
      });

      expect(sendRequest).toHaveBeenCalledWith(
        'https://api.github.com/graphql/graphql',
        {
          method: 'POST',
          headers: {
            'X-Custom-Header': 'custom-value',
            Authorization: 'token test-token',
          },
          body: requestBody,
        },
        {
          responseType: 'text',
          refreshAccessToken: expect.any(Function),
        },
      );
    });

    it('should use provided token and refreshToken over user store values', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const mockUser = { token: 'store-token', refreshToken: 'store-refresh-token' };
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue(mockUser);

      vi.mocked(sendRequest).mockResolvedValue({ success: true });

      await fetchAPI('/test-endpoint', {
        token: 'custom-token',
        refreshToken: 'custom-refresh-token',
        isGraphQL: true,
      });

      expect(sendRequest).toHaveBeenCalledWith(
        'https://api.github.com/graphql/test-endpoint',
        {
          method: 'GET',
          headers: { Authorization: 'token custom-token' },
          body: null,
        },
        {
          responseType: 'json',
          refreshAccessToken: expect.any(Function),
        },
      );
    });

    it('should not provide refreshAccessToken when no refresh token is available', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const mockUser = { token: 'test-token' }; // No refreshToken
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue(mockUser);

      vi.mocked(sendRequest).mockResolvedValue({ success: true });

      await fetchAPI('/test-endpoint', { isGraphQL: false });

      expect(sendRequest).toHaveBeenCalledWith(
        'https://api.github.com/test-endpoint',
        {
          method: 'GET',
          headers: { Authorization: 'token test-token' },
          body: null,
        },
        {
          responseType: 'json',
          refreshAccessToken: undefined,
        },
      );
    });

    it('should handle different auth schemes with isGraphQL option', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');

      // Update config to use bearer auth scheme
      Object.assign(apiConfig, { authScheme: 'Bearer' });

      const mockUser = { token: 'test-token', refreshToken: 'test-refresh-token' };
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue(mockUser);

      vi.mocked(sendRequest).mockResolvedValue({ success: true });

      await fetchAPI('/test-endpoint', { isGraphQL: true });

      expect(sendRequest).toHaveBeenCalledWith(
        'https://api.github.com/graphql/test-endpoint',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer test-token' },
          body: null,
        },
        {
          responseType: 'json',
          refreshAccessToken: expect.any(Function),
        },
      );
    });

    it('should handle undefined user in store', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      // Mock user store to return undefined
      vi.mocked(get).mockReturnValue(undefined);

      vi.mocked(sendRequest).mockResolvedValue({ success: true });

      await fetchAPI('/test-endpoint', {
        token: 'provided-token',
        refreshToken: 'provided-refresh-token',
      });

      expect(sendRequest).toHaveBeenCalledWith(
        'https://api.github.com/test-endpoint',
        {
          method: 'GET',
          headers: { Authorization: 'token provided-token' },
          body: null,
        },
        {
          responseType: 'json',
          refreshAccessToken: expect.any(Function),
        },
      );
    });

    it('should invoke refreshAccessToken callback when provided', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      const mockUser = {
        token: 'test-token',
        refreshToken: 'test-refresh-token',
      };

      vi.mocked(get).mockReturnValue(mockUser);
      vi.mocked(sendRequest).mockResolvedValue({ success: true });

      await fetchAPI('/test-endpoint', { refreshToken: 'provided-refresh-token' });

      const [, , options] = vi.mocked(sendRequest).mock.calls[0];

      expect(options).toHaveProperty('refreshAccessToken');
      expect(typeof options?.refreshAccessToken).toBe('function');
    });

    it('should handle undefined token and refreshToken from user and params', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue(null);
      vi.mocked(sendRequest).mockResolvedValue({ success: true });

      await fetchAPI('/test-endpoint', {});

      expect(sendRequest).toHaveBeenCalledWith(
        'https://api.github.com/test-endpoint',
        {
          method: 'GET',
          headers: { Authorization: 'token undefined' },
          body: null,
        },
        {
          responseType: 'json',
          refreshAccessToken: undefined,
        },
      );
    });

    it('should use provided token when user token is undefined', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue(null);
      vi.mocked(sendRequest).mockResolvedValue({ success: true });

      await fetchAPI('/test-endpoint', { token: 'provided-token' });

      expect(sendRequest).toHaveBeenCalledWith(
        'https://api.github.com/test-endpoint',
        {
          method: 'GET',
          headers: { Authorization: 'token provided-token' },
          body: null,
        },
        expect.anything(),
      );
    });

    it('should set correct responseType in sendRequest', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue(new Blob());

      await fetchAPI('/test-endpoint', { responseType: 'blob' });

      expect(sendRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({ responseType: 'blob' }),
      );
    });
  });

  describe('fetchGraphQL', () => {
    beforeEach(() => {
      // Set up API config for GraphQL tests
      Object.assign(apiConfig, {
        clientId: 'test-client-id',
        tokenURL: 'https://api.github.com/oauth/token',
        restBaseURL: 'https://api.github.com',
        graphqlBaseURL: 'https://api.github.com/graphql',
        authScheme: 'token',
      });
    });

    it('should be available as an export', async () => {
      const { fetchGraphQL } = await import('./api');

      expect(typeof fetchGraphQL).toBe('function');
    });

    it('normalizes query by removing line breaks and spaces', async () => {
      const { fetchGraphQL } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: { test: 'result' } });

      const query = `query {
        repository(owner: "test") {
          name
        }
      }`;

      await fetchGraphQL(query);

      expect(sendRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            query: 'query { repository(owner: "test") { name } }',
          }),
        }),
        expect.anything(),
      );
    });

    it('applies common variables from graphqlVars when query includes them', async () => {
      const { fetchGraphQL } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: { test: 'result' } });

      // Set up graphqlVars (these should be applied automatically)
      graphqlVars.owner = 'test-owner';
      graphqlVars.repo = 'test-repo';

      const query =
        'query($owner: String!, $repo: String!) { repository(owner: $owner, name: $repo) { name } }';

      await fetchGraphQL(query);

      expect(sendRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            variables: {
              owner: 'test-owner',
              repo: 'test-repo',
            },
          }),
        }),
        expect.anything(),
      );
    });

    it('allows passed variables to override graphqlVars', async () => {
      const { fetchGraphQL } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: { test: 'result' } });

      // Set up graphqlVars
      graphqlVars.owner = 'default-owner';

      const query = 'query($owner: String!) { repository(owner: $owner) { name } }';
      const customVariables = { owner: 'custom-owner' };

      await fetchGraphQL(query, customVariables);

      expect(sendRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            variables: expect.objectContaining({
              owner: 'custom-owner',
            }),
          }),
        }),
        expect.anything(),
      );
    });

    it('only applies graphqlVars that are used in the query', async () => {
      const { fetchGraphQL } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: { test: 'result' } });

      // Set up graphqlVars
      graphqlVars.owner = 'test-owner';
      graphqlVars.repo = 'test-repo';
      graphqlVars.branch = 'main';

      // Query only uses $owner, not $repo or $branch
      const query = 'query($owner: String!) { repository(owner: $owner) { name } }';

      await fetchGraphQL(query);

      expect(sendRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: expect.objectContaining({
            variables: {
              owner: 'test-owner',
              // repo and branch should NOT be included
            },
          }),
        }),
        expect.anything(),
      );

      // Verify repo and branch are not in variables
      const { calls } = vi.mocked(sendRequest).mock;
      const lastCall = calls[calls.length - 1];

      if (lastCall?.[1]?.body && typeof lastCall[1].body === 'object') {
        expect(lastCall[1].body).not.toHaveProperty('variables.repo');
        expect(lastCall[1].body).not.toHaveProperty('variables.branch');
      }
    });

    it('extracts and returns data from the API response', async () => {
      const { fetchGraphQL } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');
      const mockData = { repository: { name: 'test-repo', owner: 'test-owner' } };

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: mockData });

      const query = 'query { repository { name owner } }';
      const result = await fetchGraphQL(query);

      expect(result).toEqual(mockData);
    });

    it('handles queries with no variables', async () => {
      const { fetchGraphQL } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: { test: 'result' } });

      const query = 'query { viewer { login } }';

      await fetchGraphQL(query);

      expect(sendRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: {
            query: 'query { viewer { login } }',
            variables: {},
          },
        }),
        expect.anything(),
      );
    });

    it('handles GraphQL query with whitespace and newlines', async () => {
      const { fetchGraphQL } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: { result: 'test' } });

      const query = `
        query($fullPath: ID!) {
          project(fullPath: $fullPath) {
            repository {
              tree {
                blobs {
                  nodes {
                    path
                    sha
                  }
                }
              }
            }
          }
        }
      `;

      await fetchGraphQL(query, { fullPath: 'owner/repo' });

      /** @type {any} */
      const [, callArgs] = vi.mocked(sendRequest).mock.calls[0];
      const bodyObj = callArgs.body;

      expect(bodyObj.query).toMatch(/query\(\s*\$fullPath:\s*ID!\s*\)/);
      expect(bodyObj.query).not.toContain('\n');
    });

    it('applies graphqlVars only when variables are referenced in query', async () => {
      const { fetchGraphQL } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: { test: 'result' } });

      // Mock graphqlVars with multiple variables
      graphqlVars.owner = 'default-owner';
      graphqlVars.repo = 'default-repo';
      graphqlVars.unused = 'should-not-be-included';

      const query =
        'query($owner: String!, $repo: String!) { repository(owner: $owner, repo: $repo) { name } }';

      await fetchGraphQL(query);

      /** @type {any} */
      const [, callArgs] = vi.mocked(sendRequest).mock.calls[0];
      const bodyObj = callArgs.body;

      expect(bodyObj.variables).toEqual({
        owner: 'default-owner',
        repo: 'default-repo',
      });
      expect(bodyObj.variables).not.toHaveProperty('unused');
    });

    it('prefers passed variables over graphqlVars', async () => {
      const { fetchGraphQL } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: { test: 'result' } });

      graphqlVars.owner = 'default-owner';

      const query = 'query($owner: String!) { repository(owner: $owner) { name } }';
      const customVariables = { owner: 'custom-owner', extra: 'param' };

      await fetchGraphQL(query, customVariables);

      /** @type {any} */
      const [, callArgs] = vi.mocked(sendRequest).mock.calls[0];
      const bodyObj = callArgs.body;

      expect(bodyObj.variables.owner).toBe('custom-owner');
      expect(bodyObj.variables.extra).toBe('param');
    });

    it('returns data extracted from response', async () => {
      const { fetchGraphQL } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      const mockData = {
        project: {
          repository: {
            tree: {
              blobs: {
                nodes: [{ path: 'file.md', sha: 'abc123' }],
              },
            },
          },
        },
      };

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: mockData });

      const query = 'query { project { repository { tree { blobs { nodes { path sha } } } } } }';
      const result = await fetchGraphQL(query);

      expect(result).toEqual(mockData);
    });

    it('should not include refreshAccessToken when refreshToken is undefined', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: { result: 'test' } });

      await fetchAPI('/test', { method: 'GET' });

      expect(sendRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          refreshAccessToken: undefined,
        }),
      );
    });

    it('should invoke refreshAccessToken callback when provided', async () => {
      const { fetchAPI } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      vi.mocked(get).mockReturnValue({ token: 'test-token', refreshToken: 'refresh-token' });

      // Mock sendRequest to call the refreshAccessToken callback
      /** @type {any} */
      let refreshCallback;

      vi.mocked(sendRequest).mockImplementation((url, options, sendOptions) => {
        refreshCallback = sendOptions?.refreshAccessToken;
        return Promise.resolve({ data: { result: 'test' } });
      });

      // Mock the fetch function for token refresh
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'new-token',
          refresh_token: 'new-refresh-token',
        }),
      });

      await fetchAPI('/test', { method: 'GET', refreshToken: 'refresh-token' });

      // Verify the callback was created and can be called
      expect(refreshCallback).toBeDefined();

      // Call the refresh callback to trigger the refresh logic
      const result = await refreshCallback();

      expect(result).toEqual({
        token: 'new-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('handles empty graphqlVars', async () => {
      const { fetchGraphQL } = await import('./api');
      const { sendRequest } = await import('$lib/services/utils/networking');
      const { get } = await import('svelte/store');

      // Clear graphqlVars
      Object.keys(graphqlVars).forEach((key) => {
        delete graphqlVars[key];
      });

      vi.mocked(get).mockReturnValue({ token: 'test-token' });
      vi.mocked(sendRequest).mockResolvedValue({ data: { test: 'result' } });

      const query = 'query { viewer { login } }';

      await fetchGraphQL(query);

      /** @type {any} */
      const [, callArgs] = vi.mocked(sendRequest).mock.calls[0];
      const bodyObj = callArgs.body;

      expect(bodyObj.variables).toEqual({});
    });
  });
});
