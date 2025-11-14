// @ts-nocheck
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the dependencies with factory functions
vi.mock('$lib/services/config', async () => {
  const { writable } = await import('svelte/store');

  return {
    cmsConfig: writable(undefined),
  };
});

vi.mock('$lib/services/backends', async () => {
  const { writable } = await import('svelte/store');

  return {
    backend: writable(undefined),
  };
});

describe('git/shared/integration', () => {
  /** @type {import('svelte/store').Writable<any>} */
  let cmsConfig;
  /** @type {import('svelte/store').Writable<any>} */
  let backend;

  beforeEach(async () => {
    // Import the mocked stores
    const configModule = await import('$lib/services/config');
    const backendModule = await import('$lib/services/backends');

    cmsConfig = configModule.cmsConfig;
    backend = backendModule.backend;

    // Reset to initial state
    cmsConfig.set(undefined);
    backend.set(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('skipCIConfigured', () => {
    it('should return false when cmsConfig is undefined', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.set(undefined);
      backend.set({ isGit: true });

      expect(get(skipCIConfigured)).toBe(false);
    });

    it('should return false when backend is undefined', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.set({ backend: { name: 'github', repo: 'test/repo' } });
      backend.set(undefined);

      expect(get(skipCIConfigured)).toBe(false);
    });

    it('should return false when backend is not Git', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.set({ backend: { name: 'test-repo' } });
      backend.set({ isGit: false });

      expect(get(skipCIConfigured)).toBe(false);
    });

    it('should return false when neither skip_ci nor automatic_deployments is set', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.set({ backend: { name: 'github', repo: 'test/repo' } });
      backend.set({ isGit: true });

      expect(get(skipCIConfigured)).toBe(false);
    });

    it('should return true when skip_ci is explicitly set to true', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.set({
        backend: { name: 'github', repo: 'test/repo', skip_ci: true },
      });
      backend.set({ isGit: true });

      expect(get(skipCIConfigured)).toBe(true);
    });

    it('should return true when skip_ci is explicitly set to false', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.set({
        backend: { name: 'github', repo: 'test/repo', skip_ci: false },
      });
      backend.set({ isGit: true });

      expect(get(skipCIConfigured)).toBe(true);
    });

    it('should return true when automatic_deployments is explicitly set to true', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.set({
        backend: { name: 'github', repo: 'test/repo', automatic_deployments: true },
      });
      backend.set({ isGit: true });

      expect(get(skipCIConfigured)).toBe(true);
    });

    it('should return true when automatic_deployments is explicitly set to false', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.set({
        backend: { name: 'github', repo: 'test/repo', automatic_deployments: false },
      });
      backend.set({ isGit: true });

      expect(get(skipCIConfigured)).toBe(true);
    });

    it('should return true when both skip_ci and automatic_deployments are set', async () => {
      const { skipCIConfigured } = await import('./integration');

      cmsConfig.set({
        backend: {
          name: 'github',
          repo: 'test/repo',
          skip_ci: true,
          automatic_deployments: false,
        },
      });
      backend.set({ isGit: true });

      expect(get(skipCIConfigured)).toBe(true);
    });
  });

  describe('skipCIEnabled', () => {
    it('should return false when cmsConfig is undefined', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.set(undefined);
      backend.set({ isGit: true });

      expect(get(skipCIEnabled)).toBe(false);
    });

    it('should return false when backend is undefined', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.set({ backend: { name: 'github', repo: 'test/repo' } });
      backend.set(undefined);

      expect(get(skipCIEnabled)).toBe(false);
    });

    it('should return false when backend is not Git', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.set({ backend: { name: 'test-repo' } });
      backend.set({ isGit: false });

      expect(get(skipCIEnabled)).toBe(false);
    });

    it('should return false when neither skip_ci nor automatic_deployments is set', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.set({ backend: { name: 'github', repo: 'test/repo' } });
      backend.set({ isGit: true });

      expect(get(skipCIEnabled)).toBe(false);
    });

    it('should return true when skip_ci is true', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.set({
        backend: { name: 'github', repo: 'test/repo', skip_ci: true },
      });
      backend.set({ isGit: true });

      expect(get(skipCIEnabled)).toBe(true);
    });

    it('should return false when skip_ci is false', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.set({
        backend: { name: 'github', repo: 'test/repo', skip_ci: false },
      });
      backend.set({ isGit: true });

      expect(get(skipCIEnabled)).toBe(false);
    });

    it('should return true when automatic_deployments is false', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.set({
        backend: { name: 'github', repo: 'test/repo', automatic_deployments: false },
      });
      backend.set({ isGit: true });

      expect(get(skipCIEnabled)).toBe(true);
    });

    it('should return false when automatic_deployments is true', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.set({
        backend: { name: 'github', repo: 'test/repo', automatic_deployments: true },
      });
      backend.set({ isGit: true });

      expect(get(skipCIEnabled)).toBe(false);
    });

    it('should return true when skip_ci is true and automatic_deployments is true', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.set({
        backend: {
          name: 'github',
          repo: 'test/repo',
          skip_ci: true,
          automatic_deployments: true,
        },
      });
      backend.set({ isGit: true });

      expect(get(skipCIEnabled)).toBe(true);
    });

    it('should return true when skip_ci is true and automatic_deployments is false', async () => {
      const { skipCIEnabled } = await import('./integration');

      cmsConfig.set({
        backend: {
          name: 'github',
          repo: 'test/repo',
          skip_ci: true,
          automatic_deployments: false,
        },
      });
      backend.set({ isGit: true });

      expect(get(skipCIEnabled)).toBe(true);
    });

    it('should update when dependencies change', async () => {
      const { skipCIEnabled } = await import('./integration');

      // Initially disabled
      cmsConfig.set({ backend: { name: 'github', repo: 'test/repo' } });
      backend.set({ isGit: true });
      expect(get(skipCIEnabled)).toBe(false);

      // Enable skip_ci
      cmsConfig.set({
        backend: { name: 'github', repo: 'test/repo', skip_ci: true },
      });
      expect(get(skipCIEnabled)).toBe(true);

      // Disable skip_ci
      cmsConfig.set({
        backend: { name: 'github', repo: 'test/repo', skip_ci: false },
      });
      expect(get(skipCIEnabled)).toBe(false);

      // Disable automatic_deployments (should enable skip CI)
      cmsConfig.set({
        backend: { name: 'github', repo: 'test/repo', automatic_deployments: false },
      });
      expect(get(skipCIEnabled)).toBe(true);
    });
  });
});
