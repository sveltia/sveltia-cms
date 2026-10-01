import { beforeEach, describe, expect, test, vi } from 'vitest';

import { apiConfig } from '$lib/services/backends/git/shared/api';

import { checkInstanceVersion, instance } from './instance.js';

// Mock dependencies with vi.hoisted to ensure proper hoisting
const getMock = vi.hoisted(() => vi.fn());
const fetchAPIMock = vi.hoisted(() => vi.fn());
const sendRequestMock = vi.hoisted(() => vi.fn());

vi.mock('@sveltia/i18n', () => ({
  _: vi.fn((key) => key),
}));

vi.mock('$lib/services/backends/git/shared/api', () => ({
  apiConfig: { restBaseURL: 'https://git.example.com/api/v1', includeCredentials: false },
  fetchAPI: fetchAPIMock,
}));

vi.mock('$lib/services/utils/networking', () => ({
  sendRequest: sendRequestMock,
}));

vi.mock('$lib/services/backends/git/gitea/repository', () => ({
  repository: {},
}));

vi.mock('$lib/services/backends/git/gitea/constants', () => ({
  MIN_FORGEJO_VERSION: 11,
  MIN_GITEA_VERSION: 1.23,
}));

describe('Gitea Instance Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock _ to return a translation function
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

    // The Forgejo-specific version endpoint exists by default
    sendRequestMock.mockResolvedValue({ ok: true });

    apiConfig.includeCredentials = false;

    // Reset instance state
    Object.assign(instance, { isForgejo: false });
  });

  describe('checkInstanceVersion', () => {
    test('should detect and accept supported Gitea version', async () => {
      const mockVersionResponse = {
        version: '1.24.5',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).resolves.toBeUndefined();

      expect(instance.isForgejo).toBe(false);
      expect(fetchAPIMock).toHaveBeenCalledWith('/version');
    });

    test('should detect Forgejo version by version number > 10', async () => {
      const mockVersionResponse = {
        version: '11.0.1-87-5e379c9+gitea-1.24.0',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).resolves.toBeUndefined();

      expect(instance.isForgejo).toBe(true);
      expect(fetchAPIMock).toHaveBeenCalledWith('/version');
    });

    test('should detect Forgejo without the fork indicator by its own endpoint', async () => {
      const mockVersionResponse = {
        version: '13.0.3',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).resolves.toBeUndefined();

      expect(instance.isForgejo).toBe(true);
      expect(fetchAPIMock).toHaveBeenCalledWith('/version');
    });

    test('should reject unsupported Gitea version', async () => {
      const mockVersionResponse = {
        version: '1.20.0',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).rejects.toThrow('Unsupported Gitea version');
    });

    test('should reject unsupported Forgejo version', async () => {
      const mockVersionResponse = {
        version: '10.5.0+gitea-1.24.0',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).rejects.toThrow('Unsupported Forgejo version');
    });

    test.each([
      // Forgejo moved to its own major versions at 7.0; it reports them with a Gitea suffix
      '7.0.14+gitea-1.21.11',
      '9.1.0+gitea-1.22.0',
      '10.0.3+gitea-1.22.0',
      // Some installations leave the suffix out
      '10.0.0',
      '8.0.0',
    ])('should reject older Forgejo version %s as Forgejo', async (version) => {
      fetchAPIMock.mockResolvedValue({ version });

      await expect(checkInstanceVersion()).rejects.toThrow('Unsupported Forgejo version');
      expect(instance.isForgejo).toBe(true);
    });

    test.each(['28.0.0', '28.1.2+dev-12-gabcdef0'])(
      'should detect Gitea %s as Gitea when the Forgejo endpoint is missing',
      async (version) => {
        fetchAPIMock.mockResolvedValue({ version });
        sendRequestMock.mockResolvedValue({ ok: false, status: 404 });

        await expect(checkInstanceVersion()).resolves.toBeUndefined();
        expect(instance.isForgejo).toBe(false);
        expect(sendRequestMock).toHaveBeenCalledWith(
          'https://git.example.com/api/forgejo/v1/version',
          {},
          { responseType: 'raw' },
        );
      },
    );

    test.each([
      ['13.0.3', true],
      ['28.0.0', false],
    ])(
      'should fall back to the version number for %s when the Forgejo endpoint fails',
      async (version, isForgejo) => {
        fetchAPIMock.mockResolvedValue({ version });
        sendRequestMock.mockRejectedValue(new Error('Failed to send the request'));

        await expect(checkInstanceVersion()).resolves.toBeUndefined();
        expect(instance.isForgejo).toBe(isForgejo);
      },
    );

    test.each([
      ['13.0.3', 401, true],
      ['28.0.0', 500, false],
    ])(
      'should fall back to the version number for %s when the Forgejo endpoint returns %i',
      async (version, status, isForgejo) => {
        fetchAPIMock.mockResolvedValue({ version });
        sendRequestMock.mockResolvedValue({ ok: false, status });

        await expect(checkInstanceVersion()).resolves.toBeUndefined();
        expect(instance.isForgejo).toBe(isForgejo);
      },
    );

    test.each([
      ['13.0.3', true],
      ['28.0.0', false],
    ])(
      'should fall back to the version number for %s when the Forgejo endpoint redirects',
      async (version, isForgejo) => {
        fetchAPIMock.mockResolvedValue({ version });
        sendRequestMock.mockResolvedValue({ ok: true, status: 200, redirected: true });

        await expect(checkInstanceVersion()).resolves.toBeUndefined();
        expect(instance.isForgejo).toBe(isForgejo);
      },
    );

    test('should send cookies with the probe when credentials are included', async () => {
      apiConfig.includeCredentials = true;
      fetchAPIMock.mockResolvedValue({ version: '13.0.3' });

      await checkInstanceVersion();

      expect(sendRequestMock).toHaveBeenCalledWith(
        'https://git.example.com/api/forgejo/v1/version',
        { credentials: 'include' },
        { responseType: 'raw' },
      );
    });

    test('should not probe the Forgejo endpoint for Gitea 1.x or a suffixed version', async () => {
      fetchAPIMock.mockResolvedValue({ version: '1.24.5' });
      await checkInstanceVersion();
      fetchAPIMock.mockResolvedValue({ version: '13.0.3+gitea-1.22.0' });
      await checkInstanceVersion();

      expect(sendRequestMock).not.toHaveBeenCalled();
    });

    test('should detect a Gitea development build as Gitea', async () => {
      fetchAPIMock.mockResolvedValue({ version: '1.27.0+dev-954-g1f3981a301' });

      await expect(checkInstanceVersion()).resolves.toBeUndefined();
      expect(instance.isForgejo).toBe(false);
    });

    test('should handle edge case version numbers', async () => {
      const mockVersionResponse = {
        version: '1.24.0',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).resolves.toBeUndefined();
      expect(instance.isForgejo).toBe(false);
    });

    test('should handle Forgejo version at minimum threshold (11.0.0)', async () => {
      const mockVersionResponse = {
        version: '11.0.0+gitea-1.24.0',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await expect(checkInstanceVersion()).resolves.toBeUndefined();
      expect(instance.isForgejo).toBe(true);
    });

    test('should handle Forgejo version above 10 threshold', async () => {
      const mockVersionResponse = {
        version: '12.0.0',
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

      // parseFloat(undefined) returns NaN, and NaN < any number is false, so this should resolve
      await expect(checkInstanceVersion()).resolves.toBeUndefined();
      expect(instance.isForgejo).toBe(false);
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
        version: '13.1.5-123-abcdefg+gitea-1.24.8',
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
        version: '1.23.5',
      };

      fetchAPIMock.mockResolvedValue(mockVersionResponse);

      await checkInstanceVersion();

      expect(instance.isForgejo).toBe(false);
    });

    test('should correctly identify Forgejo instance', async () => {
      const mockVersionResponse = {
        version: '12.0.1+gitea-1.24.0',
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
