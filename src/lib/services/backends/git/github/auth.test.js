import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getTokenPageURL, signIn, signOut } from '$lib/services/backends/git/github/auth';
import { getUserProfile } from '$lib/services/backends/git/github/user';
import { signInToBackend } from '$lib/services/backends/git/shared/auth';
import { cmsConfig } from '$lib/services/config';

// Mock dependencies
vi.mock('$lib/services/backends/git/github/user');
vi.mock('$lib/services/backends/git/shared/auth', () => ({
  signInToBackend: vi.fn(),
  signOut: vi.fn(async () => undefined),
}));
vi.mock('$lib/services/backends/git/shared/api', () => ({
  apiConfig: { authURL: undefined },
}));
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));

describe('GitHub auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cmsConfig.current = undefined;
  });

  describe('getTokenPageURL', () => {
    test('returns correct GitHub Personal Access Token URL', () => {
      const repoURL = 'https://github.com/owner/repo';
      const result = getTokenPageURL(repoURL);

      expect(result).toBe(
        'https://github.com/settings/personal-access-tokens/new?name=Sveltia+CMS&contents=write',
      );
    });

    test('handles GitHub Enterprise Server URLs', () => {
      const repoURL = 'https://github.enterprise.com/owner/repo';
      const result = getTokenPageURL(repoURL);

      expect(result).toBe(
        'https://github.enterprise.com/settings/personal-access-tokens/new?name=Sveltia+CMS&contents=write',
      );
    });

    test('handles different repository paths', () => {
      const repoURL = 'https://github.com/different-owner/different-repo';
      const result = getTokenPageURL(repoURL);

      expect(result).toBe(
        'https://github.com/settings/personal-access-tokens/new?name=Sveltia+CMS&contents=write',
      );
    });

    test('asks for pull request access when Editorial Workflow is enabled for the site', () => {
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'editorial_workflow' });

      expect(getTokenPageURL('https://github.com/owner/repo')).toBe(
        'https://github.com/settings/personal-access-tokens/new?name=Sveltia+CMS&contents=write&pull_requests=write',
      );
    });

    test('asks for pull request access when Editorial Workflow is enabled for a collection', () => {
      cmsConfig.current = /** @type {any} */ ({
        collections: [{ name: 'posts', publish_mode: 'editorial_workflow' }],
      });

      expect(getTokenPageURL('https://github.com/owner/repo')).toBe(
        'https://github.com/settings/personal-access-tokens/new?name=Sveltia+CMS&contents=write&pull_requests=write',
      );
    });

    test('asks for content access only in the simple publish mode', () => {
      cmsConfig.current = /** @type {any} */ ({ publish_mode: 'simple', collections: [] });

      expect(getTokenPageURL('https://github.com/owner/repo')).toBe(
        'https://github.com/settings/personal-access-tokens/new?name=Sveltia+CMS&contents=write',
      );
    });
  });

  describe('signIn', () => {
    test('delegates to the shared sign-in with the backend’s user profile fetcher', async () => {
      const mockUser = /** @type {any} */ ({
        id: '123',
        login: 'testuser',
        name: 'Test User',
        backendName: 'github',
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
