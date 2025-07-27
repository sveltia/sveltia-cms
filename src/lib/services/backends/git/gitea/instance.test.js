import { beforeEach, describe, expect, test, vi } from 'vitest';

import { checkInstanceVersion, instance } from './instance.js';

// Mock dependencies with vi.hoisted to ensure proper hoisting
const getMock = vi.hoisted(() => vi.fn());
const fetchAPIMock = vi.hoisted(() => vi.fn());

vi.mock('svelte/store', () => ({
  get: getMock,
}));

vi.mock('svelte-i18n', () => ({
  _: {}, // Mock _ as a store-like object
}));

vi.mock('$lib/services/backends/git/shared/api', () => ({
  fetchAPI: fetchAPIMock,
}));

vi.mock('$lib/services/backends/git/gitea/repository', () => ({
  repository: {},
}));

vi.mock('$lib/services/backends/git/gitea/constants', () => ({
  MIN_FORGEJO_VERSION: 11.0,
  MIN_GITEA_VERSION: 1.22,
}));

describe('Gitea Instance Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock get(_) to return a translation function
    // @ts-ignore
    getMock.mockReturnValue((key, options) => {
      switch (key) {
        case 'backend_unsupported_version':
          return `Unsupported ${options?.values?.name} version. Please upgrade to v${
            options?.values?.version
          } or later.`;
        default:
          return key;
      }
    });

    // Reset instance state
    Object.assign(instance, { isForgejo: false });
  });

  describe('checkInstanceVersion', () => {
    test('should detect and accept supported Gitea version', async () => {
      const mockVersionResponse = {
        version: '1.22.5',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).resolves.toBeUndefined();

      expect(instance.isForgejo).toBe(false);
      expect(fetchAPIMock).toHaveBeenCalledWith('/version');
    });

    test('should detect and accept supported Forgejo version', async () => {
      const mockVersionResponse = {
        version: '11.0.1-87-5e379c9+gitea-1.22.0',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).resolves.toBeUndefined();

      expect(instance.isForgejo).toBe(true);
      expect(fetchAPIMock).toHaveBeenCalledWith('/version');
    });

    test('should reject unsupported Gitea version', async () => {
      const mockVersionResponse = {
        version: '1.21.0',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).rejects.toThrow('Unsupported Gitea version');
    });

    test('should reject unsupported Forgejo version', async () => {
      const mockVersionResponse = {
        version: '10.5.0+gitea-1.21.0',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).rejects.toThrow('Unsupported Forgejo version');
    });

    test('should handle edge case version numbers', async () => {
      const mockVersionResponse = {
        version: '1.22.0',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).resolves.toBeUndefined();
      expect(instance.isForgejo).toBe(false);
    });

    test('should handle Forgejo version at minimum threshold', async () => {
      const mockVersionResponse = {
        version: '11.0.0+gitea-1.22.0',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).resolves.toBeUndefined();
      expect(instance.isForgejo).toBe(true);
    });

    test('should handle API fetch error', async () => {
      fetchAPIMock.mockRejectedValue(new Error('Network error'));

      await expect(checkInstanceVersion()).rejects.toThrow('Network error');
    });

    test('should handle missing version property in response', async () => {
      const mockVersionResponse = {};

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      // This should throw when trying to access version.includes or parseFloat
      await expect(checkInstanceVersion()).rejects.toThrow();
    });

    test('should handle non-numeric version string', async () => {
      const mockVersionResponse = {
        version: 'invalid-version-string',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      // parseFloat('invalid-version-string') returns NaN
      // NaN < any number is false, so this should NOT throw
      await expect(checkInstanceVersion()).resolves.toBeUndefined();
      expect(instance.isForgejo).toBe(false);
    });

    test('should handle complex Forgejo version string', async () => {
      const mockVersionResponse = {
        version: '12.1.5-123-abcdefg+gitea-1.22.8',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).resolves.toBeUndefined();
      expect(instance.isForgejo).toBe(true);
    });

    test('should handle version string with extra characters', async () => {
      const mockVersionResponse = {
        version: '1.23.0-rc1',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).resolves.toBeUndefined();
      expect(instance.isForgejo).toBe(false);
    });

    test('should correctly identify Gitea instance', async () => {
      const mockVersionResponse = {
        version: '1.22.5',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await checkInstanceVersion();

      expect(instance.isForgejo).toBe(false);
    });

    test('should correctly identify Forgejo instance', async () => {
      const mockVersionResponse = {
        version: '11.0.1+gitea-1.22.0',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await checkInstanceVersion();

      expect(instance.isForgejo).toBe(true);
    });
  });

  describe('instance object', () => {
    test('should initialize with default values', () => {
      expect(instance).toHaveProperty('isForgejo');
      expect(instance.isForgejo).toBe(false);
    });

    test('should be mutable for configuration', () => {
      instance.isForgejo = true;
      expect(instance.isForgejo).toBe(true);

      instance.isForgejo = false;
      expect(instance.isForgejo).toBe(false);
    });
  });
});
