import { get } from 'svelte/store';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import {
  allBackendServices,
  validBackendNames,
  gitBackendServices,
  backendName,
  backend,
  isLastCommitPublished,
} from './index.js';

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

  describe('backendName store', () => {
    test('should be a writable store', () => {
      expect(backendName).toHaveProperty('set');
      expect(backendName).toHaveProperty('update');
      expect(backendName).toHaveProperty('subscribe');
    });

    test('should initialize with undefined', () => {
      const value = get(backendName);

      expect(value).toBeUndefined();
    });

    test('should update value when set', () => {
      backendName.set('github');
      expect(get(backendName)).toBe('github');
    });
  });

  describe('backend store', () => {
    test('should be a readable store', () => {
      expect(backend).toHaveProperty('subscribe');
    });

    test('should return undefined when no backend name is set', () => {
      backendName.set(undefined);

      const value = get(backend);

      expect(value).toBeUndefined();
    });

    test('should return backend service when valid name is set', () => {
      // Mock the init function
      const mockInit = vi.fn();

      allBackendServices.github.init = mockInit;

      backendName.set('github');

      const value = get(backend);

      expect(value).toBe(allBackendServices.github);
      expect(mockInit).toHaveBeenCalled();
    });

    test('should call init when backend changes', () => {
      const mockInit = vi.fn();

      allBackendServices.gitlab.init = mockInit;

      backendName.set('gitlab');
      get(backend); // Trigger the derived store

      expect(mockInit).toHaveBeenCalled();
    });

    test('should not call init again for the same backend', () => {
      const mockInit = vi.fn();

      allBackendServices.gitea.init = mockInit;

      backendName.set('gitea');
      get(backend); // First access
      get(backend); // Second access

      expect(mockInit).toHaveBeenCalledTimes(1);
    });
  });

  describe('isLastCommitPublished store', () => {
    test('should be a writable store', () => {
      expect(isLastCommitPublished).toHaveProperty('set');
      expect(isLastCommitPublished).toHaveProperty('update');
      expect(isLastCommitPublished).toHaveProperty('subscribe');
    });

    test('should initialize with true', () => {
      const value = get(isLastCommitPublished);

      expect(value).toBe(true);
    });

    test('should update value when set', () => {
      isLastCommitPublished.set(false);
      expect(get(isLastCommitPublished)).toBe(false);
    });
  });
});
