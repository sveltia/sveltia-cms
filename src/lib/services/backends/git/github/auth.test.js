import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { signIn, signOut } from '$lib/services/backends/git/github/auth';
import { getUserProfile } from '$lib/services/backends/git/github/user';
import { initServerSideAuth } from '$lib/services/backends/git/shared/auth';

// Mock dependencies
vi.mock('$lib/services/backends/git/github/user');
vi.mock('$lib/services/backends/git/shared/auth');
vi.mock('$lib/services/backends/git/shared/api', () => ({
  apiConfig: { authURL: undefined },
}));
vi.mock('$lib/services/config', () => ({
  siteConfig: { subscribe: vi.fn() },
}));
vi.mock('svelte/store', () => ({
  get: vi.fn(),
  writable: vi.fn(() => ({ subscribe: vi.fn(), set: vi.fn(), update: vi.fn() })),
  derived: vi.fn(() => ({ subscribe: vi.fn() })),
}));

describe('GitHub auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock behavior
    vi.mocked(get).mockReturnValue({
      backend: { site_domain: 'example.com' },
    });
  });

  describe('signIn', () => {
    test('returns undefined for auto sign-in without token', async () => {
      const result = await signIn({ auto: true });

      expect(result).toBeUndefined();
    });

    test('signs in with provided token', async () => {
      const mockUser = /** @type {any} */ ({
        id: '123',
        login: 'testuser',
        name: 'Test User',
        backendName: 'github',
      });

      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      const result = await signIn({ token: 'test-token', auto: false });

      expect(getUserProfile).toHaveBeenCalledWith({ token: 'test-token' });
      expect(result).toEqual(mockUser);
    });

    test('initiates server-side auth when no token provided', async () => {
      const mockUser = /** @type {any} */ ({
        id: '123',
        login: 'testuser',
        name: 'Test User',
        backendName: 'github',
      });

      vi.mocked(initServerSideAuth).mockResolvedValue({ token: 'new-token' });
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      const result = await signIn({ auto: false });

      expect(initServerSideAuth).toHaveBeenCalledWith({
        backendName: 'github',
        siteDomain: 'example.com',
        authURL: undefined,
        scope: 'repo,user',
      });
      expect(getUserProfile).toHaveBeenCalledWith({ token: 'new-token' });
      expect(result).toEqual(mockUser);
    });

    test('initiates server-side auth when no token provided and no site domain', async () => {
      const mockUser = /** @type {any} */ ({
        id: '123',
        login: 'testuser',
        name: 'Test User',
        backendName: 'github',
      });

      // Mock get to return backend without site_domain
      vi.mocked(get).mockReturnValueOnce({ backend: {} });

      vi.mocked(initServerSideAuth).mockResolvedValue({ token: 'new-token' });
      vi.mocked(getUserProfile).mockResolvedValue(mockUser);

      const result = await signIn({ auto: false });

      expect(initServerSideAuth).toHaveBeenCalledWith({
        backendName: 'github',
        siteDomain: undefined,
        authURL: undefined,
        scope: 'repo,user',
      });
      expect(getUserProfile).toHaveBeenCalledWith({ token: 'new-token' });
      expect(result).toEqual(mockUser);
    });
  });

  describe('signOut', () => {
    test('returns undefined', async () => {
      const result = await signOut();

      expect(result).toBeUndefined();
    });
  });
});
