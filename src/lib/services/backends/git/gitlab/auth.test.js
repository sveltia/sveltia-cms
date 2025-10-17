import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getPatURL, signIn, signOut } from '$lib/services/backends/git/gitlab/auth';
import { getUserProfile } from '$lib/services/backends/git/gitlab/user';
import {
  handleClientSideAuthPopup,
  initClientSideAuth,
  initServerSideAuth,
} from '$lib/services/backends/git/shared/auth';

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
vi.mock('$lib/services/config', () => ({
  siteConfig: { subscribe: vi.fn() },
}));
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() })),
  derived: vi.fn(() => ({ subscribe: vi.fn() })),
}));

describe('GitLab auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock behavior
    vi.mocked(get).mockReturnValue({
      backend: { site_domain: 'example.com' },
    });

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

  describe('getPatURL', () => {
    test('returns correct GitLab Personal Access Token URL', () => {
      const repoURL = 'https://gitlab.com/owner/repo';
      const result = getPatURL(repoURL);

      expect(result).toBe(
        'https://gitlab.com/-/user_settings/personal_access_tokens?name=Sveltia+CMS&scopes=api%2Cread_user',
      );
    });

    test('handles GitLab self-hosted instance URLs', () => {
      const repoURL = 'https://gitlab.example.com/owner/repo';
      const result = getPatURL(repoURL);

      expect(result).toBe(
        'https://gitlab.example.com/-/user_settings/personal_access_tokens?name=Sveltia+CMS&scopes=api%2Cread_user',
      );
    });

    test('handles different repository paths', () => {
      const repoURL = 'https://gitlab.com/group/subgroup/project';
      const result = getPatURL(repoURL);

      expect(result).toBe(
        'https://gitlab.com/-/user_settings/personal_access_tokens?name=Sveltia+CMS&scopes=api%2Cread_user',
      );
    });
  });

  describe('signIn', () => {
    test('returns undefined for auto sign-in without token', async () => {
      const result = await signIn({ auto: true });

      expect(result).toBeUndefined();
    });

    test('signs in with provided token', async () => {
      const mockUser = /** @type {any} */ ({
        id: 123,
        username: 'testuser',
        name: 'Test User',
        backendName: 'gitlab',
      });

      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      const result = await signIn({ token: 'test-token', auto: false });

      expect(getUserProfile).toHaveBeenCalledWith({ token: 'test-token' });
      expect(result).toEqual(mockUser);
    });

    test('initiates server-side auth when no token provided', async () => {
      const mockUser = /** @type {any} */ ({
        id: 123,
        username: 'testuser',
        name: 'Test User',
        backendName: 'gitlab',
      });

      vi.mocked(initServerSideAuth).mockResolvedValue({ token: 'new-token' });
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      const result = await signIn({ auto: false });

      expect(initServerSideAuth).toHaveBeenCalledWith({
        backendName: 'gitlab',
        authURL: 'https://gitlab.com/oauth/authorize',
        scope: 'api',
        siteDomain: 'example.com',
      });
      expect(getUserProfile).toHaveBeenCalledWith({ token: 'new-token' });
      expect(result).toEqual(mockUser);
    });

    test('initiates server-side auth when siteConfig is null', async () => {
      const mockUser = /** @type {any} */ ({
        id: 123,
        username: 'testuser',
        name: 'Test User',
        backendName: 'gitlab',
      });

      vi.mocked(get).mockReturnValueOnce(null);

      vi.mocked(initServerSideAuth).mockResolvedValue({ token: 'new-token' });
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      const result = await signIn({ auto: false });

      expect(initServerSideAuth).toHaveBeenCalledWith({
        backendName: 'gitlab',
        authURL: 'https://gitlab.com/oauth/authorize',
        scope: 'api',
        siteDomain: undefined,
      });
      expect(getUserProfile).toHaveBeenCalledWith({ token: 'new-token' });
      expect(result).toEqual(mockUser);
    });

    test('initiates PKCE auth when auth_type is pkce', async () => {
      const mockUser = /** @type {any} */ ({
        id: 123,
        username: 'testuser',
        name: 'Test User',
        backendName: 'gitlab',
      });

      vi.mocked(get).mockReturnValue({
        backend: {
          site_domain: 'example.com',
          auth_type: 'pkce',
        },
      });

      vi.mocked(initClientSideAuth).mockResolvedValue({
        token: 'pkce-token',
        refreshToken: 'refresh-token',
      });
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      const result = await signIn({ auto: false });

      expect(initClientSideAuth).toHaveBeenCalledWith({
        backendName: 'gitlab',
        authURL: 'https://gitlab.com/oauth/authorize',
        scope: 'api',
        clientId: 'test-client-id',
      });
      expect(getUserProfile).toHaveBeenCalledWith({
        token: 'pkce-token',
        refreshToken: 'refresh-token',
      });
      expect(result).toEqual(mockUser);
    });

    test('handles PKCE popup flow', async () => {
      vi.mocked(get).mockReturnValue({
        backend: { auth_type: 'pkce' },
      });

      // Mock window properties to simulate popup
      window.opener = { origin: window.location.origin };
      window.name = 'auth';

      vi.mocked(handleClientSideAuthPopup).mockResolvedValue(undefined);

      const result = await signIn({ auto: false });

      expect(handleClientSideAuthPopup).toHaveBeenCalledWith({
        backendName: 'gitlab',
        clientId: 'test-client-id',
        tokenURL: 'https://gitlab.com/oauth/token',
      });
      expect(result).toBeUndefined();
    });

    test('returns undefined for auto sign-in with PKCE', async () => {
      vi.mocked(get).mockReturnValue({
        backend: { auth_type: 'pkce' },
      });

      const result = await signIn({ auto: true });

      expect(result).toBeUndefined();
    });

    test('handles PKCE flow in popup window', async () => {
      const mockConfig = {
        backend: {
          name: 'gitlab',
          auth_type: 'pkce',
        },
      };

      vi.mocked(get).mockReturnValue(mockConfig);

      // Mock window properties to simulate being in an auth popup
      Object.defineProperty(window, 'opener', {
        value: { origin: window.location.origin },
        configurable: true,
      });
      Object.defineProperty(window, 'name', {
        value: 'auth',
        configurable: true,
      });

      const result = await signIn({ auto: true });

      expect(result).toBeUndefined();
      expect(vi.mocked(handleClientSideAuthPopup)).toHaveBeenCalledWith({
        backendName: 'gitlab',
        clientId: 'test-client-id',
        tokenURL: 'https://gitlab.com/oauth/token',
      });
    });
  });

  describe('signOut', () => {
    test('returns undefined', async () => {
      const result = await signOut();

      expect(result).toBeUndefined();
    });
  });
});
