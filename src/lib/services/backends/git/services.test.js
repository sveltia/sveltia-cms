import { beforeEach, describe, expect, test, vi } from 'vitest';

import { loadChunk } from '$lib/services/app/dependencies';

vi.mock('$lib/services/app/dependencies', () => ({
  loadChunk: vi.fn(),
}));

// The wrapper is tested on its own; here it only has to mark the services it has wrapped
vi.mock('$lib/services/backends/git/shared/scope', () => ({
  scopeBackendService: vi.fn((service) => ({ ...service, scoped: true })),
}));

/**
 * Import a fresh copy of the module, as it keeps the loaded services.
 * @returns {Promise<typeof import('./services')>} Module.
 */
const importServices = async () => {
  vi.resetModules();

  return import('./services');
};

describe('gitBackendServices', () => {
  test('bundles GitHub and lists the others before they’re loaded', async () => {
    const { gitBackendServices } = await importServices();

    expect(Object.keys(gitBackendServices)).toEqual(['github', 'gitlab', 'gitea', 'forgejo']);
    expect(gitBackendServices.github).toMatchObject({ name: 'github' });
    expect(gitBackendServices.gitlab).toBeUndefined();
    expect(gitBackendServices.gitea).toBeUndefined();
    expect(gitBackendServices.forgejo).toBeUndefined();
  });
});

describe('loadGitBackendService', () => {
  beforeEach(() => {
    vi.mocked(loadChunk).mockImplementation(async (name) =>
      name === 'gitea'
        ? { gitea: { name: 'gitea' }, forgejo: { name: 'forgejo' } }
        : { gitlab: { name: 'gitlab' } },
    );
  });

  test('returns GitHub without loading anything', async () => {
    const { gitBackendServices, loadGitBackendService } = await importServices();

    await expect(loadGitBackendService('github')).resolves.toBe(gitBackendServices.github);
    expect(loadChunk).not.toHaveBeenCalled();
  });

  test('loads a service from its chunk and wraps it', async () => {
    const { gitBackendServices, loadGitBackendService } = await importServices();
    const service = await loadGitBackendService('gitlab');

    expect(loadChunk).toHaveBeenCalledWith('gitlab');
    expect(service).toEqual({ name: 'gitlab', scoped: true });
    expect(gitBackendServices.gitlab).toBe(service);
  });

  test('adds every service of a chunk, so it’s only loaded once', async () => {
    const { gitBackendServices, loadGitBackendService } = await importServices();

    await expect(loadGitBackendService('forgejo')).resolves.toEqual({
      name: 'forgejo',
      scoped: true,
    });
    expect(gitBackendServices.gitea).toEqual({ name: 'gitea', scoped: true });

    await loadGitBackendService('gitea');

    expect(loadChunk).toHaveBeenCalledOnce();
    expect(loadChunk).toHaveBeenCalledWith('gitea');
  });

  test('requests a chunk once while it’s being loaded', async () => {
    const { loadGitBackendService } = await importServices();

    await Promise.all([loadGitBackendService('gitea'), loadGitBackendService('forgejo')]);

    expect(loadChunk).toHaveBeenCalledOnce();
  });

  test('tries a chunk again after a failure', async () => {
    const { loadGitBackendService } = await importServices();

    vi.mocked(loadChunk).mockRejectedValueOnce(new Error('Offline'));

    await expect(loadGitBackendService('gitlab')).rejects.toThrow('Offline');
    await expect(loadGitBackendService('gitlab')).resolves.toMatchObject({ name: 'gitlab' });
    expect(loadChunk).toHaveBeenCalledTimes(2);
  });

  test('returns nothing for a name that isn’t a Git backend', async () => {
    const { loadGitBackendService } = await importServices();

    await expect(loadGitBackendService('local')).resolves.toBeUndefined();
    expect(loadChunk).not.toHaveBeenCalled();
  });
});
