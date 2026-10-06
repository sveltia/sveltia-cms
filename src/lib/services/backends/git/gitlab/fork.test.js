import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  createFork,
  fetchFork,
  fetchForkByName,
  fetchForkFromNetwork,
  fetchProjectDetails,
  fetchRepositoryAccess,
  getWorkflowRepository,
  initOpenAuthoring,
  isOpenAuthoringConfigured,
  projectIds,
  waitForFork,
} from '$lib/services/backends/git/gitlab/fork';
import { fetchProjectPermissions } from '$lib/services/backends/git/gitlab/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import {
  forkedRepository,
  openAuthoringInitialized,
  requestForkPermission,
} from '$lib/services/workflow/open-authoring';

vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn().mockResolvedValue(undefined) }));
vi.mock('$lib/services/backends/git/gitlab/repository', () => {
  const mockRepository = { owner: 'group/sub', repo: 'project', branch: 'main' };

  return {
    repository: mockRepository,
    fetchProjectPermissions: vi.fn(),
    /**
     * Get the project ID the same way the real module does.
     * @param {any} [repoPath] Project to address. Default: the configured project.
     * @returns {string} URL-encoded project path.
     */
    getProjectId: ({ owner, repo } = mockRepository) => encodeURIComponent(`${owner}/${repo}`),
    /**
     * Split a project path the same way the real module does.
     * @param {string} path Full project path.
     * @returns {any} Namespace and project name.
     */
    parseProjectPath: (path) => {
      const [repo, ...owner] = path.split('/').reverse();

      return { owner: owner.reverse().join('/'), repo };
    },
  };
});
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));
vi.mock('$lib/services/user/account.svelte', () => ({
  user: { account: { id: 7, login: 'contributor' } },
}));
vi.mock('$lib/services/workflow/open-authoring', () => ({
  forkedRepository: { current: undefined },
  openAuthoringInitialized: { current: false },
  requestForkPermission: vi.fn(),
}));

const PROJECT_ID = encodeURIComponent('group/sub/project');
const FORK_ID = encodeURIComponent('contributor/project');

/**
 * Create the fork as the REST API returns it, in the signed-in user’s own namespace.
 * @param {object} [overrides] Properties to override.
 * @returns {any} Project.
 */
const createForkProject = (overrides = {}) => ({
  id: 77,
  path_with_namespace: 'contributor/project',
  namespace: { kind: 'user', full_path: 'contributor' },
  forked_from_project: { path_with_namespace: 'Group/Sub/Project' },
  ...overrides,
});

/**
 * Pretend the signed-in user has the given access to the configured project.
 * @param {object} [args] Arguments.
 * @param {boolean} [args.found] Whether the project is visible to the user.
 * @param {boolean} [args.canPush] Whether the user can push to the project.
 */
const grantAccess = ({ found = true, canPush = false } = {}) => {
  vi.mocked(fetchProjectPermissions).mockResolvedValue({ found, canPush });
};

describe('GitLab Open Authoring service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitlab', open_authoring: true } });
    forkedRepository.current = undefined;
    openAuthoringInitialized.current = false;
    projectIds.base = undefined;
    projectIds.fork = undefined;
    grantAccess();
    vi.mocked(fetchAPI).mockResolvedValue({});
  });

  describe('isOpenAuthoringConfigured', () => {
    test('is on for a GitLab backend with the option enabled', () => {
      expect(isOpenAuthoringConfigured()).toBe(true);
    });

    test('is off without the option, for another backend, or without a config', () => {
      cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitlab' } });
      expect(isOpenAuthoringConfigured()).toBe(false);

      cmsConfig.current = /** @type {any} */ ({
        backend: { name: 'github', open_authoring: true },
      });
      expect(isOpenAuthoringConfigured()).toBe(false);

      cmsConfig.current = undefined;
      expect(isOpenAuthoringConfigured()).toBe(false);
    });
  });

  describe('getWorkflowRepository', () => {
    test('is the configured project without a fork', () => {
      expect(getWorkflowRepository()).toEqual({ owner: 'group/sub', repo: 'project' });
    });

    test('is the fork while contributing', () => {
      const fork = { owner: 'contributor', repo: 'project' };

      forkedRepository.current = fork;
      expect(getWorkflowRepository()).toBe(fork);
    });
  });

  describe('fetchRepositoryAccess', () => {
    test('reports a maintainer', async () => {
      grantAccess({ canPush: true });

      await expect(fetchRepositoryAccess()).resolves.toEqual({ canWrite: true });
    });

    test('reports a contributor who can read but not push', async () => {
      await expect(fetchRepositoryAccess()).resolves.toEqual({ canWrite: false });
    });

    test('rejects a project the user can’t see', async () => {
      grantAccess({ found: false });

      // The shared message is what the sign-in flow looks for to drop the cached credentials
      await expect(fetchRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
    });

    test('leaves an unanswered question visible rather than assuming no write access', async () => {
      vi.mocked(fetchProjectPermissions).mockRejectedValue(
        new Error('Too Many Requests', { cause: { status: 429 } }),
      );

      await expect(fetchRepositoryAccess()).rejects.toThrow(
        'Failed to check the repository permission.',
      );
    });
  });

  describe('fetchProjectDetails', () => {
    test('remembers the numeric project ID and reports that forks are allowed', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ id: 42 });

      await expect(fetchProjectDetails()).resolves.toEqual({ allowForking: true });

      expect(fetchAPI).toHaveBeenCalledWith(`/projects/${PROJECT_ID}`);
      expect(projectIds.base).toBe(42);
    });

    test('reports a project that can’t be forked', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ id: 42, forking_access_level: 'disabled' });

      await expect(fetchProjectDetails()).resolves.toEqual({ allowForking: false });
    });

    test('reports a failure to read the project with something to act on', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(
        new Error('Too Many Requests', { cause: { status: 429 } }),
      );

      // Nothing can be set up without the ID, and a bare API error gives the contributor nothing
      await expect(fetchProjectDetails()).rejects.toThrow('Failed to read the repository.');
      expect(projectIds.base).toBeUndefined();
    });
  });

  describe('fetchForkByName', () => {
    test('finds the fork at the default path', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createForkProject());

      await expect(fetchForkByName()).resolves.toEqual({
        owner: 'contributor',
        repo: 'project',
      });

      expect(fetchAPI).toHaveBeenCalledWith(`/projects/${FORK_ID}`);
      // The ID is what a merge request’s source project is later checked against
      expect(projectIds.fork).toBe(77);
    });

    test('ignores a project GitLab resolved outside the user’s own namespace', async () => {
      // GitLab keeps a redirect for a renamed or transferred project, so the path it resolves can
      // sit elsewhere — and everything the CMS writes would go there
      vi.mocked(fetchAPI).mockResolvedValue(
        createForkProject({
          path_with_namespace: 'acme/project',
          namespace: { kind: 'group', full_path: 'acme' },
        }),
      );

      await expect(fetchForkByName()).resolves.toBeUndefined();
      expect(projectIds.fork).toBeUndefined();
    });

    test('gives up when there is no such project', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Not Found', { cause: { status: 404 } }));
      await expect(fetchForkByName()).resolves.toBeUndefined();
    });

    test('ignores a project that isn’t a fork of the configured one', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createForkProject({ forked_from_project: undefined }));

      await expect(fetchForkByName()).resolves.toBeUndefined();
    });
  });

  describe('fetchForkFromNetwork', () => {
    test('finds the fork in the user’s own namespace', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([
        // A fork in a group the contributor belongs to isn’t theirs
        {
          id: 88,
          path_with_namespace: 'team/renamed',
          namespace: { kind: 'group', full_path: 'team' },
        },
        {
          id: 77,
          path_with_namespace: 'contributor/renamed',
          namespace: { kind: 'user', full_path: 'contributor' },
        },
      ]);

      await expect(fetchForkFromNetwork()).resolves.toEqual({
        owner: 'contributor',
        repo: 'renamed',
      });

      expect(projectIds.fork).toBe(77);

      expect(fetchAPI).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/forks?owned=true&per_page=100`,
      );
    });

    test('gives up when there is no match', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([]);
      await expect(fetchForkFromNetwork()).resolves.toBeUndefined();
    });

    test('gives up when the list can’t be read', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Forbidden'));
      await expect(fetchForkFromNetwork()).resolves.toBeUndefined();
    });
  });

  describe('fetchFork', () => {
    test('falls back to the fork list when the default path is empty', async () => {
      vi.mocked(fetchAPI)
        .mockRejectedValueOnce(new Error('Not Found'))
        .mockResolvedValueOnce([
          {
            id: 77,
            path_with_namespace: 'contributor/renamed',
            namespace: { kind: 'user', full_path: 'contributor' },
          },
        ]);

      await expect(fetchFork()).resolves.toEqual({ owner: 'contributor', repo: 'renamed' });
    });
  });

  describe('waitForFork', () => {
    const fork = { owner: 'contributor', repo: 'project' };

    test.each(['finished', 'none', undefined])('accepts the %s import status', async (status) => {
      vi.mocked(fetchAPI).mockResolvedValue({ import_status: status });

      await expect(waitForFork(fork)).resolves.toBeUndefined();
      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });

    test('polls until the copy is complete', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ import_status: 'started' })
        .mockResolvedValueOnce({ import_status: 'finished' });

      await expect(waitForFork(fork)).resolves.toBeUndefined();
      expect(fetchAPI).toHaveBeenCalledTimes(2);
    });

    test('keeps waiting while the fork can’t be read yet', async () => {
      vi.mocked(fetchAPI)
        .mockRejectedValueOnce(new Error('Not Found'))
        .mockResolvedValueOnce({ import_status: 'finished' });

      await expect(waitForFork(fork)).resolves.toBeUndefined();
      expect(fetchAPI).toHaveBeenCalledTimes(2);
    });

    test('gives up right away when the import failed', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ import_status: 'failed' });

      await expect(waitForFork(fork)).rejects.toThrow('The fork could not be created.');
      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });

    test('gives up once the attempts run out', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Not Found'));

      await expect(waitForFork(fork, 2)).rejects.toThrow(
        'Timed out waiting for the fork to be created.',
      );

      expect(fetchAPI).toHaveBeenCalledTimes(2);
    });
  });

  describe('createFork', () => {
    test('forks the project and waits for the copy', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ id: 77, path_with_namespace: 'contributor/project' })
        .mockResolvedValueOnce({ import_status: 'finished' });

      await expect(createFork()).resolves.toEqual({ owner: 'contributor', repo: 'project' });
      expect(projectIds.fork).toBe(77);

      expect(fetchAPI).toHaveBeenNthCalledWith(1, `/projects/${PROJECT_ID}/fork`, {
        method: 'POST',
      });
    });

    test('reports a fork request that was refused', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      vi.mocked(fetchAPI).mockRejectedValue(new Error('Forbidden'));

      await expect(createFork()).rejects.toThrow('Failed to fork the repository.');
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });
  });

  describe('initOpenAuthoring', () => {
    /**
     * Mock the requests a contributor’s set-up makes: the project details, then the fork lookup.
     * @param {object} [args] Arguments.
     * @param {any} [args.project] Project as returned by the REST API.
     * @param {any} [args.fork] Project at the fork’s default path, or `undefined` if there is none.
     */
    const mockSetUp = ({ project = { id: 42 }, fork } = {}) => {
      vi.mocked(fetchAPI).mockImplementation(async (path) => {
        if (path === `/projects/${PROJECT_ID}`) {
          return project;
        }

        if (path === `/projects/${FORK_ID}`) {
          if (!fork) {
            throw new Error('Not Found', { cause: { status: 404 } });
          }

          return fork;
        }

        // The fork list, which is only asked for when the default path came up empty
        return [];
      });
    };

    test('leaves a maintainer on the configured project', async () => {
      // A fork from an earlier session is forgotten
      forkedRepository.current = { owner: 'contributor', repo: 'project' };
      grantAccess({ canPush: true });

      await initOpenAuthoring();

      expect(forkedRepository.current).toBeUndefined();
      expect(openAuthoringInitialized.current).toBe(true);
      expect(requestForkPermission).not.toHaveBeenCalled();
      // A maintainer’s sign-in doesn’t pay for the project details either
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    test('reuses an existing fork without asking', async () => {
      mockSetUp({ fork: createForkProject() });

      await initOpenAuthoring();

      expect(requestForkPermission).not.toHaveBeenCalled();
      expect(forkedRepository.current).toEqual({ owner: 'contributor', repo: 'project' });
      expect(openAuthoringInitialized.current).toBe(true);
    });

    test('stops when the project doesn’t allow forks', async () => {
      mockSetUp({ project: { id: 42, forking_access_level: 'disabled' } });

      await expect(initOpenAuthoring()).rejects.toThrow('The repository does not allow forking');
      expect(requestForkPermission).not.toHaveBeenCalled();
      // The set-up didn’t finish, so nothing that depends on it should proceed
      expect(openAuthoringInitialized.current).toBe(false);
    });

    test('stops when the contributor declines the fork', async () => {
      mockSetUp();
      vi.mocked(requestForkPermission).mockResolvedValue(false);

      await expect(initOpenAuthoring()).rejects.toThrow(
        'Permission to fork the repository was declined',
      );
    });

    test('creates the fork once the contributor agrees', async () => {
      mockSetUp();
      vi.mocked(requestForkPermission).mockResolvedValue(true);

      vi.mocked(fetchAPI).mockImplementation(async (path, options) => {
        if (path === `/projects/${PROJECT_ID}/fork` && options?.method === 'POST') {
          return { id: 77, path_with_namespace: 'contributor/project' };
        }

        if (path === `/projects/${PROJECT_ID}`) {
          return { id: 42 };
        }

        // The fork’s own path: not found before the fork is made, ready right after
        if (vi.mocked(requestForkPermission).mock.calls.length) {
          return { import_status: 'finished' };
        }

        throw new Error('Not Found', { cause: { status: 404 } });
      });

      await initOpenAuthoring();

      expect(requestForkPermission).toHaveBeenCalledWith('group/sub/project');
      expect(forkedRepository.current).toEqual({ owner: 'contributor', repo: 'project' });
      expect(openAuthoringInitialized.current).toBe(true);
    });
  });
});
