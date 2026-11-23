import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  backend,
  backendName,
  loadBackendService,
  selectBackend,
  unsupportedBackends,
  validBackendNames,
} from '$lib/services/backends';
import local from '$lib/services/backends/fs/local';
import testRepo from '$lib/services/backends/fs/test';
import { gitBackendServices } from '$lib/services/backends/git/services';
import { cmsConfig } from '$lib/services/config';

describe('Backend Services Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cmsConfig.current = undefined;
  });

  describe('validBackendNames', () => {
    test('should contain the Git backends and the test repository', () => {
      expect(validBackendNames).toEqual(['github', 'gitlab', 'gitea', 'forgejo', 'test-repo']);
    });

    test('should not contain local backend', () => {
      expect(validBackendNames).not.toContain('local');
    });
  });

  describe('loadBackendService', () => {
    test('returns the backends that are always bundled', async () => {
      await expect(loadBackendService('github')).resolves.toBe(gitBackendServices.github);
      await expect(loadBackendService('test-repo')).resolves.toBe(testRepo);
    });

    test('loads a Git backend kept in a chunk', async () => {
      const service = await loadBackendService('gitlab');

      expect(service).toMatchObject({ isGit: true, name: 'gitlab', label: 'GitLab' });
      expect(gitBackendServices.gitlab).toBe(service);
    });

    test('loads the configured Git backend along with the local backend', async () => {
      cmsConfig.current = /** @type {any} */ ({ backend: { name: 'forgejo' } });

      await expect(loadBackendService('local')).resolves.toBe(local);
      expect(gitBackendServices.forgejo).toMatchObject({ isGit: true, name: 'forgejo' });
      expect(gitBackendServices.gitea).toMatchObject({ isGit: true, name: 'gitea' });
    });

    test('returns the local backend without a configuration', async () => {
      await expect(loadBackendService('local')).resolves.toBe(local);
    });

    test('returns nothing for an unknown backend', async () => {
      await expect(loadBackendService('unknown')).resolves.toBeUndefined();
    });
  });

  describe('backendName state', () => {
    test('should initialize with undefined', () => {
      expect(backendName.current).toBeUndefined();
    });

    test('should update value when set', () => {
      backendName.current = 'github';
      expect(backendName.current).toBe('github');
    });
  });

  describe('backend state', () => {
    test('should return undefined when no backend name is set', () => {
      backendName.current = undefined;

      expect(backend.current).toBeUndefined();
    });

    test('should return the backend service when a valid name is set', () => {
      backendName.current = 'github';
      expect(backend.current).toBe(gitBackendServices.github);

      backendName.current = 'test-repo';
      expect(backend.current).toBe(testRepo);
    });
  });

  describe('selectBackend', () => {
    beforeEach(async () => {
      await selectBackend(undefined);
    });

    test('should load, select and initialize the backend service', async () => {
      const service = /** @type {any} */ (await loadBackendService('gitlab'));
      const mockInit = vi.spyOn(service, 'init').mockReturnValue(undefined);

      await expect(selectBackend('gitlab')).resolves.toBe(service);
      expect(backendName.current).toBe('gitlab');
      expect(backend.current).toBe(service);
      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    test('should not initialize the same backend again', async () => {
      const service = /** @type {any} */ (await loadBackendService('gitea'));
      const mockInit = vi.spyOn(service, 'init').mockReturnValue(undefined);

      await selectBackend('gitea');
      await selectBackend('gitea');

      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    test('should deselect the backend', async () => {
      await selectBackend('test-repo');

      await expect(selectBackend(undefined)).resolves.toBeUndefined();
      expect(backendName.current).toBeUndefined();
      expect(backend.current).toBeUndefined();
    });

    test('should return undefined for an unknown backend', async () => {
      await expect(selectBackend('unknown')).resolves.toBeUndefined();
      expect(backendName.current).toBe('unknown');
      expect(backend.current).toBeUndefined();
    });
  });

  describe('unsupportedBackends', () => {
    test('should contain all unsupported backends', () => {
      expect(unsupportedBackends).toHaveProperty('azure');
      expect(unsupportedBackends).toHaveProperty('bitbucket');
      expect(unsupportedBackends).toHaveProperty('git-gateway');
    });

    test('should have label property for each backend', () => {
      Object.values(unsupportedBackends).forEach((_backend) => {
        expect(_backend).toHaveProperty('label');
        expect(typeof _backend.label).toBe('string');
      });
    });

    test('should mark git-gateway as deprecated', () => {
      expect(unsupportedBackends['git-gateway'].deprecated).toBe(true);
    });

    test('should not mark azure as deprecated', () => {
      expect(unsupportedBackends.azure.deprecated).toBeUndefined();
    });

    test('should not mark bitbucket as deprecated', () => {
      expect(unsupportedBackends.bitbucket.deprecated).toBeUndefined();
    });

    test('should have correct labels', () => {
      expect(unsupportedBackends.azure.label).toBe('Azure DevOps');
      expect(unsupportedBackends.bitbucket.label).toBe('Bitbucket');
      expect(unsupportedBackends['git-gateway'].label).toBe('Git Gateway');
    });
  });
});
