import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  allBackendServices,
  backend,
  backendName,
  gitBackendServices,
  selectBackend,
  unsupportedBackends,
  validBackendNames,
} from '.';

describe('Backend Services Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('allBackendServices', () => {
    test('should contain all expected backend services', () => {
      expect(allBackendServices).toHaveProperty('github');
      expect(allBackendServices).toHaveProperty('gitlab');
      expect(allBackendServices).toHaveProperty('gitea');
      expect(allBackendServices).toHaveProperty('local');
      expect(allBackendServices).toHaveProperty('test-repo');
    });

    test('should have backend services with required properties', () => {
      Object.values(allBackendServices).forEach((service) => {
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('label');
        expect(service).toHaveProperty('isGit');
        expect(service).toHaveProperty('init');
        expect(service).toHaveProperty('signIn');
        expect(service).toHaveProperty('signOut');
        expect(service).toHaveProperty('fetchFiles');
        expect(service).toHaveProperty('commitChanges');
        expect(typeof service.name).toBe('string');
        expect(typeof service.label).toBe('string');
        expect(typeof service.isGit).toBe('boolean');
        expect(typeof service.init).toBe('function');
        expect(typeof service.signIn).toBe('function');
        expect(typeof service.signOut).toBe('function');
        expect(typeof service.fetchFiles).toBe('function');
        expect(typeof service.commitChanges).toBe('function');
      });
    });
  });

  describe('validBackendNames', () => {
    test('should contain expected backend names', () => {
      expect(validBackendNames).toContain('github');
      expect(validBackendNames).toContain('gitlab');
      expect(validBackendNames).toContain('gitea');
      expect(validBackendNames).toContain('test-repo');
    });

    test('should not contain local backend', () => {
      expect(validBackendNames).not.toContain('local');
    });

    test('should match keys of allBackendServices except local', () => {
      const expectedNames = Object.keys(allBackendServices).filter((name) => name !== 'local');

      expect(validBackendNames).toEqual(expect.arrayContaining(expectedNames));
      expect(validBackendNames).toHaveLength(expectedNames.length);
    });
  });

  describe('gitBackendServices', () => {
    test('should contain only Git backend services', () => {
      Object.values(gitBackendServices).forEach((service) => {
        expect(service.isGit).toBe(true);
      });
    });

    test('should not contain non-Git backends', () => {
      const nonGitServices = Object.entries(allBackendServices)
        .filter(([, service]) => !service.isGit)
        .map(([name]) => name);

      nonGitServices.forEach((name) => {
        expect(gitBackendServices).not.toHaveProperty(name);
      });
    });

    test('should contain expected Git backends', () => {
      expect(gitBackendServices).toHaveProperty('github');
      expect(gitBackendServices).toHaveProperty('gitlab');
      expect(gitBackendServices).toHaveProperty('gitea');
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

      expect(backend.current).toBe(allBackendServices.github);
    });
  });

  describe('selectBackend', () => {
    beforeEach(() => {
      selectBackend(undefined);
    });

    test('should select and initialize the backend service', () => {
      const mockInit = vi.fn();

      allBackendServices.gitlab.init = mockInit;

      expect(selectBackend('gitlab')).toBe(allBackendServices.gitlab);
      expect(backendName.current).toBe('gitlab');
      expect(backend.current).toBe(allBackendServices.gitlab);
      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    test('should not initialize the same backend again', () => {
      const mockInit = vi.fn();

      allBackendServices.gitea.init = mockInit;

      selectBackend('gitea');
      selectBackend('gitea');

      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    test('should deselect the backend', () => {
      selectBackend('github');

      expect(selectBackend(undefined)).toBeUndefined();
      expect(backendName.current).toBeUndefined();
      expect(backend.current).toBeUndefined();
    });

    test('should return undefined for an unknown backend', () => {
      expect(selectBackend('unknown')).toBeUndefined();
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
