// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the dependencies with factory functions
vi.mock('$lib/services/config', () => ({
  cmsConfig: { current: undefined },
}));

vi.mock('$lib/services/backends', () => ({
  backend: { current: undefined },
}));

describe('git/shared/integration', () => {
  /** @type {{ current: any }} */
  let cmsConfig;
  /** @type {{ current: any }} */
  let backend;

  beforeEach(async () => {
    // Import the mocked stores
    const configModule = await import('$lib/services/config');
    const backendModule = await import('$lib/services/backends');

    cmsConfig = configModule.cmsConfig;
    backend = backendModule.backend;

    // Reset to initial state
    cmsConfig.current = undefined;
    backend.current = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('skipCIConfigured', () => {
    it('should return false when cmsConfig is undefined', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.current = undefined;
      backend.current = { isGit: true };

      expect(skipCIConfigured.current).toBe(false);
    });

    it('should return false when backend is undefined', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.current = { backend: { name: 'github', repo: 'test/repo' } };
      backend.current = undefined;

      expect(skipCIConfigured.current).toBe(false);
    });

    it('should return false when backend is not Git', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.current = { backend: { name: 'test-repo' } };
      backend.current = { isGit: false };

      expect(skipCIConfigured.current).toBe(false);
    });

    it('should return false when neither skip_ci nor automatic_deployments is set', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.current = { backend: { name: 'github', repo: 'test/repo' } };
      backend.current = { isGit: true };

      expect(skipCIConfigured.current).toBe(false);
    });

    it('should return true when skip_ci is explicitly set to true', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.current = {
        backend: { name: 'github', repo: 'test/repo', skip_ci: true },
      };
      backend.current = { isGit: true };

      expect(skipCIConfigured.current).toBe(true);
    });

    it('should return true when skip_ci is explicitly set to false', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.current = {
        backend: { name: 'github', repo: 'test/repo', skip_ci: false },
      };
      backend.current = { isGit: true };

      expect(skipCIConfigured.current).toBe(true);
    });

    it('should return true when automatic_deployments is explicitly set to true', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.current = {
        backend: { name: 'github', repo: 'test/repo', automatic_deployments: true },
      };
      backend.current = { isGit: true };

      expect(skipCIConfigured.current).toBe(true);
    });

    it('should return true when automatic_deployments is explicitly set to false', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.current = {
        backend: { name: 'github', repo: 'test/repo', automatic_deployments: false },
      };
      backend.current = { isGit: true };

      expect(skipCIConfigured.current).toBe(true);
    });

    it('should return true when both skip_ci and automatic_deployments are set', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.current = {
        backend: {
          name: 'github',
          repo: 'test/repo',
          skip_ci: true,
          automatic_deployments: false,
        },
      };
      backend.current = { isGit: true };

      expect(skipCIConfigured.current).toBe(true);
    });
  });

  describe('skipCIEnabled', () => {
    it('should return false when cmsConfig is undefined', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.current = undefined;
      backend.current = { isGit: true };

      expect(skipCIEnabled.current).toBe(false);
    });

    it('should return false when backend is undefined', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.current = { backend: { name: 'github', repo: 'test/repo' } };
      backend.current = undefined;

      expect(skipCIEnabled.current).toBe(false);
    });

    it('should return false when backend is not Git', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.current = { backend: { name: 'test-repo' } };
      backend.current = { isGit: false };

      expect(skipCIEnabled.current).toBe(false);
    });

    it('should return false when neither skip_ci nor automatic_deployments is set', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.current = { backend: { name: 'github', repo: 'test/repo' } };
      backend.current = { isGit: true };

      expect(skipCIEnabled.current).toBe(false);
    });

    it('should return true when skip_ci is true', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.current = {
        backend: { name: 'github', repo: 'test/repo', skip_ci: true },
      };
      backend.current = { isGit: true };

      expect(skipCIEnabled.current).toBe(true);
    });

    it('should return false when skip_ci is false', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.current = {
        backend: { name: 'github', repo: 'test/repo', skip_ci: false },
      };
      backend.current = { isGit: true };

      expect(skipCIEnabled.current).toBe(false);
    });

    it('should return true when automatic_deployments is false', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.current = {
        backend: { name: 'github', repo: 'test/repo', automatic_deployments: false },
      };
      backend.current = { isGit: true };

      expect(skipCIEnabled.current).toBe(true);
    });

    it('should return false when automatic_deployments is true', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.current = {
        backend: { name: 'github', repo: 'test/repo', automatic_deployments: true },
      };
      backend.current = { isGit: true };

      expect(skipCIEnabled.current).toBe(false);
    });

    it('should return true when skip_ci is true and automatic_deployments is true', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.current = {
        backend: {
          name: 'github',
          repo: 'test/repo',
          skip_ci: true,
          automatic_deployments: true,
        },
      };
      backend.current = { isGit: true };

      expect(skipCIEnabled.current).toBe(true);
    });

    it('should return true when skip_ci is true and automatic_deployments is false', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.current = {
        backend: {
          name: 'github',
          repo: 'test/repo',
          skip_ci: true,
          automatic_deployments: false,
        },
      };
      backend.current = { isGit: true };

      expect(skipCIEnabled.current).toBe(true);
    });

    it('should update when dependencies change', async () => {
      const { skipCIEnabled } = await import('./integration');

      // Initially disabled
      cmsConfig.current = { backend: { name: 'github', repo: 'test/repo' } };
      backend.current = { isGit: true };
      expect(skipCIEnabled.current).toBe(false);

      // Enable skip_ci
      cmsConfig.current = {
        backend: { name: 'github', repo: 'test/repo', skip_ci: true },
      };
      expect(skipCIEnabled.current).toBe(true);

      // Disable skip_ci
      cmsConfig.current = {
        backend: { name: 'github', repo: 'test/repo', skip_ci: false },
      };
      expect(skipCIEnabled.current).toBe(false);

      // Disable automatic_deployments (should enable skip CI)
      cmsConfig.current = {
        backend: { name: 'github', repo: 'test/repo', automatic_deployments: false },
      };
      expect(skipCIEnabled.current).toBe(true);
    });
  });
});
