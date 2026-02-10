/* eslint-disable camelcase */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * @import { ConfigParserCollectors } from '$lib/types/private';
 */

// Mock svelte-i18n
/** @type {Record<string, string>} */
const mockI18nStrings = {
  'config.error.missing_backend': 'Missing backend configuration',
  'config.error.missing_backend_name': 'Backend name is required',
  'config.error.unsupported_known_backend': 'Unsupported backend: {name}',
  'config.error.unsupported_custom_backend': 'Unsupported backend: {name}',
  'config.error.unsupported_backend_suggestion': 'Please check the supported backends.',
  'config.error.missing_repository': 'Missing repository',
  'config.error.invalid_repository': 'Invalid repository format',
  'config.error.oauth_implicit_flow': 'OAuth implicit flow is not supported',
  'config.error.github_pkce_unsupported': 'GitHub does not support PKCE authentication',
  'config.error.oauth_no_app_id': 'OAuth app ID is required',
};

/**
 * Mock translation function.
 * @param {string} key Message key.
 * @param {object & { values?: Record<string, string> }} [options] Options.
 * @returns {string} Translated string.
 */
function mockTranslate(key, options) {
  let message = mockI18nStrings[key] || key;

  if (options?.values) {
    Object.entries(options.values).forEach(([k, v]) => {
      message = message.replace(`{${k}}`, v);
    });
  }

  return message;
}

vi.mock('svelte-i18n', () => ({
  _: {
    subscribe: vi.fn((fn) => {
      fn(mockTranslate);

      return () => {};
    }),
  },
  locale: {
    subscribe: vi.fn((fn) => {
      fn('en-US');

      return () => {};
    }),
  },
}));

const mockGetStore = vi.fn();

vi.mock('svelte/store', () => ({
  get: mockGetStore,
}));

const mockIsObject = vi.fn();

vi.mock('@sveltia/utils/object', () => ({
  isObject: mockIsObject,
}));

const mockWarnDeprecation = vi.fn();

vi.mock('$lib/services/config/deprecations', () => ({
  warnDeprecation: mockWarnDeprecation,
}));

vi.mock('$lib/services/backends', () => ({
  gitBackendServices: {
    github: { name: 'github' },
    gitlab: { name: 'gitlab' },
    gitea: { name: 'gitea' },
  },
  validBackendNames: ['github', 'gitlab', 'gitea', 'local'],
  unsupportedBackends: {
    azure: { label: 'Azure DevOps' },
    bitbucket: { label: 'Bitbucket' },
    'git-gateway': { label: 'Git Gateway' },
  },
}));

const mockCheckUnsupportedOptions = vi.fn();

vi.mock('$lib/services/config/parser/utils/validator', () => ({
  checkUnsupportedOptions: mockCheckUnsupportedOptions,
}));

/**
 * Create a fresh collectors object for testing.
 * @returns {ConfigParserCollectors} Collectors instance.
 */
function createCollectors() {
  return {
    errors: new Set(),
    warnings: new Set(),
    mediaFields: new Set(),
    relationFields: new Set(),
  };
}

describe('parseBackendConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetStore.mockImplementation((store) => {
      // Handle the i18n store
      if (store && typeof store.subscribe === 'function') {
        let result;

        store.subscribe((/** @type {any} */ value) => {
          result = value;
        })();

        return result;
      }

      return store;
    });

    mockIsObject.mockImplementation(
      /**
       * Is object check.
       * @param {any} val Value.
       * @returns {boolean} Result.
       */
      (val) => val !== null && typeof val === 'object',
    );
  });

  describe('missing or invalid backend', () => {
    it('should error when backend is missing', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();
      /** @type {any} */
      const config = {};

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Missing backend configuration');
    });

    it('should error when backend is null', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();
      /** @type {any} */
      const config = { backend: null };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Missing backend configuration');
    });

    it('should error when backend is not an object', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();
      /** @type {any} */
      const config = { backend: 'github' };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Missing backend configuration');
    });

    it('should error when backend name is missing', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();
      /** @type {any} */
      const config = { backend: {} };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Backend name is required');
    });

    it('should error when backend name is unsupported', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();
      /** @type {any} */
      const config = { backend: { name: 'bitbucket' } };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toContain('Unsupported backend: Bitbucket');
      expect(error).toContain('Please check the supported backends');
    });
  });

  describe('local backend', () => {
    it('should accept local backend without repository', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();
      /** @type {any} */
      const config = { backend: { name: 'local' } };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
      expect(mockCheckUnsupportedOptions).not.toHaveBeenCalled();
    });
  });

  describe('git backend - repository validation', () => {
    it('should accept valid GitHub backend with repository', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'github',
          repo: 'owner/repo',
        },
      };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should accept valid GitLab backend with repository', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'gitlab',
          repo: 'owner/repo',
        },
      };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should require app_id for Gitea backend (checked in OAuth section)', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'gitea',
          repo: 'owner/repo',
        },
      };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);
    });

    it('should error when repository is undefined for GitHub', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'github',
        },
      };

      parseBackendConfig(config, collectors);

      // repo === undefined check AND typeof repo !== 'string' check both fail
      expect(collectors.errors.size).toBe(2);

      const errors = [...collectors.errors];

      expect(errors.some((e) => e === 'Missing repository')).toBe(true);
      expect(errors.some((e) => e === 'Invalid repository format')).toBe(true);
    });

    it('should error when repository is not a string', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'github',
          repo: 123,
        },
      };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Invalid repository format');
    });

    it('should error when repository format is invalid (missing slash)', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'github',
          repo: 'owner-without-slash',
        },
      };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('Invalid repository format');
    });

    it('should allow repository format with multiple slashes (regex matches)', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'github',
          repo: 'owner/repo/extra',
        },
      };

      parseBackendConfig(config, collectors);

      // The regex /(.+)\/([^/]+)$/ matches 'owner/repo/extra' as:
      // (.+) = 'owner/repo', \/ = '/', ([^/]+) = 'extra'
      // So this is actually valid
      expect(collectors.errors.size).toBe(0);
    });
  });

  describe('OAuth authentication', () => {
    it('should error when auth_type is implicit', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'github',
          repo: 'owner/repo',
          auth_type: 'implicit',
        },
      };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('OAuth implicit flow is not supported');
    });

    it('should require app_id for Gitea backend', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'gitea',
          repo: 'owner/repo',
        },
      };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('OAuth app ID is required');
    });

    it('should accept Gitea backend with app_id', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'gitea',
          repo: 'owner/repo',
          app_id: 'my-app-id',
        },
      };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(0);
    });

    it('should require app_id for PKCE auth_type', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'gitlab',
          repo: 'owner/repo',
          auth_type: 'pkce',
        },
      };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('OAuth app ID is required');
    });

    it('should error when GitHub uses PKCE authentication', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'github',
          repo: 'owner/repo',
          auth_type: 'pkce',
          app_id: 'my-app-id',
        },
      };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(1);

      const [error] = [...collectors.errors];

      expect(error).toBe('GitHub does not support PKCE authentication');
    });

    it('should error when GitHub uses PKCE without app_id', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'github',
          repo: 'owner/repo',
          auth_type: 'pkce',
        },
      };

      parseBackendConfig(config, collectors);

      expect(collectors.errors.size).toBe(2);

      const errors = [...collectors.errors];

      expect(errors.some((e) => e === 'GitHub does not support PKCE authentication')).toBe(true);
      expect(errors.some((e) => e === 'OAuth app ID is required')).toBe(true);
    });
  });

  describe('deprecated options', () => {
    it('should warn when automatic_deployments is present', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'github',
          repo: 'owner/repo',
          automatic_deployments: true,
        },
      };

      parseBackendConfig(config, collectors);

      expect(mockWarnDeprecation).toHaveBeenCalledWith('automatic_deployments');
    });

    it('should not warn when automatic_deployments is undefined', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'github',
          repo: 'owner/repo',
        },
      };

      parseBackendConfig(config, collectors);

      expect(mockWarnDeprecation).not.toHaveBeenCalled();
    });
  });

  describe('unsupported options', () => {
    it('should call checkUnsupportedOptions for git backends', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'github',
          repo: 'owner/repo',
        },
      };

      parseBackendConfig(config, collectors);

      expect(mockCheckUnsupportedOptions).toHaveBeenCalled();

      const callArgs = mockCheckUnsupportedOptions.mock.calls[0][0];

      expect(callArgs.config).toBe(config.backend);
      expect(callArgs.context).toEqual({ cmsConfig: config });
      expect(callArgs.collectors).toBe(collectors);
    });

    it('should not call checkUnsupportedOptions for local backend', async () => {
      const { parseBackendConfig } = await import('./backend.js');
      const collectors = createCollectors();

      /** @type {any} */
      const config = {
        backend: {
          name: 'local',
        },
      };

      parseBackendConfig(config, collectors);

      expect(mockCheckUnsupportedOptions).not.toHaveBeenCalled();
    });
  });
});
