import { _ } from '@sveltia/i18n';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  checkForkBranch,
  createFork,
  fetchFork,
  fetchForkByName,
  fetchForkBySearch,
  fetchForkingAllowed,
  fetchRepositoryAccess,
  getWorkflowRepository,
  initOpenAuthoring,
  isOpenAuthoringConfigured,
  syncFork,
} from '$lib/services/backends/git/gitea/fork';
import { instance } from '$lib/services/backends/git/gitea/instance';
import {
  fetchDefaultBranchName,
  getRepositoryInfo,
  repository,
} from '$lib/services/backends/git/gitea/repository';
import { fetchAPI } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { user } from '$lib/services/user/account.svelte';
import {
  forkedRepository,
  forkPermissionRequest,
  openAuthoringInitialized,
} from '$lib/services/workflow/open-authoring';

vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key) }));
vi.mock('$lib/services/backends/git/gitea/instance', () => ({ instance: { isForgejo: false } }));
vi.mock('$lib/services/backends/git/gitea/repository', () => ({
  repository: { owner: 'owner', repo: 'repo', branch: 'main' },
  fetchDefaultBranchName: vi.fn(),
  getRepositoryInfo: vi.fn(),
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('$lib/services/config', () => ({ cmsConfig: { current: undefined } }));
vi.mock('$lib/services/user/account.svelte', () => ({ user: { account: undefined } }));

/**
 * Create a `Response` carrying the given JSON body.
 * @param {any} body Body.
 * @param {number} [status] HTTP status.
 * @returns {Response} Response.
 */
const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Create an error the API client raises for a failed request.
 * @param {number} status HTTP status.
 * @param {string} [message] Message in the response body.
 * @returns {Error} Error.
 */
const apiError = (status, message = '') =>
  new Error('Server responded with an error', { cause: { status, message } });

/**
 * Answer the pending fork permission request, the way the confirmation dialog does.
 * @param {boolean} granted Whether the user granted permission.
 */
const answerForkRequest = async (granted) => {
  await vi.waitFor(() => {
    expect(forkPermissionRequest.current).toBeDefined();
  });

  forkPermissionRequest.current?.respond(granted);
};

describe('Gitea fork service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    cmsConfig.current = /** @type {any} */ ({
      backend: { name: 'gitea', open_authoring: true },
      publish_mode: 'editorial_workflow',
    });
    user.account = /** @type {any} */ ({ backendName: 'gitea', id: 42, login: 'me' });
    instance.isForgejo = false;
    repository.branch = 'main';
    forkedRepository.current = undefined;
    forkPermissionRequest.current = undefined;
    openAuthoringInitialized.current = false;
  });

  describe('isOpenAuthoringConfigured', () => {
    test('is true only with the Gitea backend and the option on', () => {
      expect(isOpenAuthoringConfigured()).toBe(true);

      cmsConfig.current = /** @type {any} */ ({ backend: { name: 'gitea' } });
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
    test('returns the configured repository unless a fork is in use', () => {
      expect(getWorkflowRepository()).toEqual({ owner: 'owner', repo: 'repo' });

      forkedRepository.current = { owner: 'me', repo: 'repo' };
      expect(getWorkflowRepository()).toEqual({ owner: 'me', repo: 'repo' });
    });
  });

  describe('fetchRepositoryAccess', () => {
    test('reports write access from the repository’s own permissions', async () => {
      vi.mocked(getRepositoryInfo).mockResolvedValue({ permissions: { push: true } });
      await expect(fetchRepositoryAccess()).resolves.toEqual({ canWrite: true });

      vi.mocked(getRepositoryInfo).mockResolvedValue({ permissions: { pull: true } });
      await expect(fetchRepositoryAccess()).resolves.toEqual({ canWrite: false });

      vi.mocked(getRepositoryInfo).mockResolvedValue({});
      await expect(fetchRepositoryAccess()).resolves.toEqual({ canWrite: false });
    });

    test.each([403, 404])('reports no access on a %s', async (status) => {
      vi.mocked(getRepositoryInfo).mockRejectedValue(apiError(status));

      // The shared message is what makes the sign-in flow drop the cached credentials
      await expect(fetchRepositoryAccess()).rejects.toThrow('Not a collaborator of the repository');
    });

    test('reports an unanswered question rather than assuming no write access', async () => {
      vi.mocked(getRepositoryInfo).mockRejectedValue(apiError(500));

      await expect(fetchRepositoryAccess()).rejects.toThrow(
        'Failed to check the repository permission.',
      );

      vi.mocked(getRepositoryInfo).mockRejectedValue(new Error('Network'));

      await expect(fetchRepositoryAccess()).rejects.toThrow(
        'Failed to check the repository permission.',
      );
    });
  });

  describe('fetchForkByName', () => {
    test('finds the fork at the default name', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        jsonResponse({
          full_name: 'me/repo',
          owner: { login: 'me' },
          fork: true,
          parent: { full_name: 'Owner/Repo' },
        }),
      );

      await expect(fetchForkByName()).resolves.toEqual({ owner: 'me', repo: 'repo' });
      expect(fetchAPI).toHaveBeenCalledWith('/repos/me/repo', { responseType: 'raw' });
    });

    test('ignores a repository of the same name that isn’t a fork of the configured one', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(jsonResponse({ full_name: 'me/repo', fork: false }));
      await expect(fetchForkByName()).resolves.toBeUndefined();

      vi.mocked(fetchAPI).mockResolvedValue(
        jsonResponse({
          full_name: 'me/repo',
          owner: { login: 'me' },
          fork: true,
          parent: { full_name: 'other/repo' },
        }),
      );
      await expect(fetchForkByName()).resolves.toBeUndefined();
    });

    test('returns nothing when there is no such repository', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(jsonResponse({ message: 'not found' }, 404));
      await expect(fetchForkByName()).resolves.toBeUndefined();
    });

    test('ignores a fork the instance redirected to another account', async () => {
      // The contributor’s fork was transferred to an organization, which the instance follows from
      // the old name. The CMS would otherwise commit to a repository that isn’t the user’s own
      vi.mocked(fetchAPI).mockResolvedValue(
        jsonResponse({
          full_name: 'some-org/repo',
          owner: { login: 'some-org' },
          fork: true,
          parent: { full_name: 'owner/repo' },
        }),
      );
      await expect(fetchForkByName()).resolves.toBeUndefined();

      vi.mocked(fetchAPI).mockResolvedValue(
        jsonResponse({ full_name: 'me/repo', fork: true, parent: { full_name: 'owner/repo' } }),
      );
      await expect(fetchForkByName()).resolves.toBeUndefined();
    });

    test('matches the owner case-insensitively, like the instance', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        jsonResponse({
          full_name: 'Me/repo',
          owner: { login: 'Me' },
          fork: true,
          parent: { full_name: 'owner/repo' },
        }),
      );
      await expect(fetchForkByName()).resolves.toEqual({ owner: 'Me', repo: 'repo' });
    });
  });

  describe('fetchForkBySearch', () => {
    test('finds a renamed fork among the user’s own forks', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        data: [
          { full_name: 'me/other', owner: { login: 'me' }, parent: { full_name: 'x/other' } },
          { full_name: 'me/my-fork', owner: { login: 'me' }, parent: { full_name: 'owner/repo' } },
        ],
      });

      await expect(fetchForkBySearch()).resolves.toEqual({ owner: 'me', repo: 'my-fork' });
      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/search?uid=42&exclusive=true&mode=fork&limit=50',
      );
    });

    test('ignores a fork owned by someone else, and copes with an empty answer', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({
        data: [
          { full_name: 'org/repo', owner: { login: 'org' }, parent: { full_name: 'owner/repo' } },
        ],
      });
      await expect(fetchForkBySearch()).resolves.toBeUndefined();

      vi.mocked(fetchAPI).mockResolvedValue({});
      await expect(fetchForkBySearch()).resolves.toBeUndefined();
    });

    test('returns nothing when the search fails', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(apiError(500));
      await expect(fetchForkBySearch()).resolves.toBeUndefined();
    });
  });

  describe('fetchFork', () => {
    test('looks at the default name first, then searches', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(jsonResponse({}, 404))
        .mockResolvedValueOnce({
          data: [
            { full_name: 'me/f', owner: { login: 'me' }, parent: { full_name: 'owner/repo' } },
          ],
        });

      await expect(fetchFork()).resolves.toEqual({ owner: 'me', repo: 'f' });
      expect(fetchAPI).toHaveBeenCalledTimes(2);
    });

    test('doesn’t search when the fork is at the default name', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        jsonResponse({
          full_name: 'me/repo',
          owner: { login: 'me' },
          fork: true,
          parent: { full_name: 'owner/repo' },
        }),
      );

      await expect(fetchFork()).resolves.toEqual({ owner: 'me', repo: 'repo' });
      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });
  });

  describe('fetchForkingAllowed', () => {
    test('allows forking on Gitea, which can’t turn it off', async () => {
      await expect(fetchForkingAllowed()).resolves.toBe(true);
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    test('reads the repository settings on Forgejo', async () => {
      instance.isForgejo = true;

      vi.mocked(fetchAPI).mockResolvedValue({ forks_disabled: true });
      await expect(fetchForkingAllowed()).resolves.toBe(false);
      expect(fetchAPI).toHaveBeenCalledWith('/settings/repository');

      vi.mocked(fetchAPI).mockResolvedValue({ forks_disabled: false });
      await expect(fetchForkingAllowed()).resolves.toBe(true);

      vi.mocked(fetchAPI).mockResolvedValue({});
      await expect(fetchForkingAllowed()).resolves.toBe(true);
    });

    test('leaves it to the fork request when the settings can’t be read', async () => {
      instance.isForgejo = true;
      vi.mocked(fetchAPI).mockRejectedValue(apiError(500));

      await expect(fetchForkingAllowed()).resolves.toBe(true);
    });
  });

  describe('createFork', () => {
    test('forks the repository at the default name', async () => {
      vi.mocked(fetchAPI).mockResolvedValue({ full_name: 'me/repo' });

      await expect(createFork()).resolves.toEqual({ owner: 'me', repo: 'repo' });
      expect(fetchAPI).toHaveBeenCalledWith('/repos/owner/repo/forks', {
        method: 'POST',
        body: {},
      });
    });

    test('picks another name when the user has an unrelated repository of that name', async () => {
      vi.mocked(fetchAPI)
        .mockRejectedValueOnce(apiError(409, 'repository already exists'))
        .mockResolvedValueOnce(jsonResponse({ full_name: 'me/repo', fork: false }))
        .mockResolvedValueOnce({ full_name: 'me/owner-repo' });

      await expect(createFork()).resolves.toEqual({ owner: 'me', repo: 'owner-repo' });
      expect(fetchAPI).toHaveBeenNthCalledWith(3, '/repos/owner/repo/forks', {
        method: 'POST',
        body: { name: 'owner-repo' },
      });
    });

    test('gives up when the retry fails as well', async () => {
      vi.mocked(fetchAPI)
        .mockRejectedValueOnce(apiError(409))
        .mockResolvedValueOnce(jsonResponse({ full_name: 'me/repo' }))
        .mockRejectedValueOnce(apiError(409));

      await expect(createFork()).rejects.toThrow('Failed to fork the repository.');
    });

    test('reports any other failure as is', async () => {
      // A conflict that isn’t about the name: the repository is already forked, or forks are off
      vi.mocked(fetchAPI)
        .mockRejectedValueOnce(apiError(409, 'already forked'))
        .mockResolvedValueOnce(jsonResponse({}, 404));

      await expect(createFork()).rejects.toThrow('Failed to fork the repository.');
      expect(fetchAPI).toHaveBeenCalledTimes(2);

      vi.mocked(fetchAPI).mockReset();
      vi.mocked(fetchAPI).mockRejectedValue(apiError(403));

      await expect(createFork()).rejects.toThrow('Failed to fork the repository.');
      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });
  });

  describe('syncFork', () => {
    test('fast-forwards the fork’s copy of the configured branch', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(new Response(null, { status: 200 }));

      await syncFork({ owner: 'me', repo: 'repo' });

      expect(fetchAPI).toHaveBeenCalledWith('/repos/me/repo/merge-upstream', {
        method: 'POST',
        body: { branch: 'main' },
        responseType: 'raw',
      });
      // eslint-disable-next-line no-console
      expect(console.warn).not.toHaveBeenCalled();
    });

    test('warns rather than fails when the fork can’t be fast-forwarded', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(new Response(null, { status: 409 }));

      await expect(syncFork({ owner: 'me', repo: 'repo' })).resolves.toBeUndefined();
      // eslint-disable-next-line no-console
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('could not be fast-forwarded'),
      );
    });

    test('warns rather than fails when the request fails', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Network'));

      await expect(syncFork({ owner: 'me', repo: 'repo' })).resolves.toBeUndefined();
      // eslint-disable-next-line no-console
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to sync'),
        expect.any(Error),
      );
    });

    /**
     * Mock Forgejo’s sync endpoints, reporting the given state and answering the sync itself.
     * @param {Record<string, any>} info Sync state.
     */
    const mockForgejoSync = (info) => {
      vi.mocked(fetchAPI).mockImplementation(async (_path, options) =>
        options?.method === 'POST' ? new Response(null, { status: 204 }) : info,
      );
    };

    test('asks Forgejo first, then syncs a fork that’s behind', async () => {
      instance.isForgejo = true;
      mockForgejoSync({ allowed: true, fork_commit: 'a', base_commit: 'b', commits_behind: 2 });

      await syncFork({ owner: 'me', repo: 'repo' });

      // Forgejo names the branch in the path
      expect(fetchAPI).toHaveBeenNthCalledWith(1, '/repos/me/repo/sync_fork/main');
      expect(fetchAPI).toHaveBeenNthCalledWith(2, '/repos/me/repo/sync_fork/main', {
        method: 'POST',
        responseType: 'raw',
      });
      // eslint-disable-next-line no-console
      expect(console.warn).not.toHaveBeenCalled();
    });

    test('leaves a fork that’s already up to date alone on Forgejo', async () => {
      // Forgejo would refuse the sync, which says nothing about the fork being out of step
      instance.isForgejo = true;
      mockForgejoSync({ allowed: false, fork_commit: 'a', base_commit: 'a', commits_behind: 0 });

      await syncFork({ owner: 'me', repo: 'repo' });

      expect(fetchAPI).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line no-console
      expect(console.warn).not.toHaveBeenCalled();
    });

    test('warns about a fork with commits of its own on Forgejo, without trying', async () => {
      instance.isForgejo = true;
      mockForgejoSync({ allowed: false, fork_commit: 'a', base_commit: 'b', commits_behind: 0 });

      await syncFork({ owner: 'me', repo: 'repo' });

      expect(fetchAPI).toHaveBeenCalledTimes(1);
      // eslint-disable-next-line no-console
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('could not be fast-forwarded'),
      );

      // An empty answer is no better
      // eslint-disable-next-line no-console
      vi.mocked(console.warn).mockClear();
      mockForgejoSync({});
      await syncFork({ owner: 'me', repo: 'repo' });
      // eslint-disable-next-line no-console
      expect(console.warn).toHaveBeenCalled();
    });

    test('encodes a branch name that would otherwise cut the path short', async () => {
      instance.isForgejo = true;
      repository.branch = 'release#1';
      mockForgejoSync({ allowed: true, fork_commit: 'a', base_commit: 'b' });

      await syncFork({ owner: 'me', repo: 'repo' });

      expect(fetchAPI).toHaveBeenCalledWith('/repos/me/repo/sync_fork/release%231');
      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/me/repo/sync_fork/release%231',
        expect.anything(),
      );
    });
  });

  describe('checkForkBranch', () => {
    test('passes when the fork has the branch', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(jsonResponse({ name: 'main' }));

      await expect(checkForkBranch({ owner: 'me', repo: 'repo' })).resolves.toBeUndefined();
      expect(fetchAPI).toHaveBeenCalledWith('/repos/me/repo/branches/main', {
        responseType: 'raw',
      });
    });

    test('names the fork, the branch and the repository when it doesn’t', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(jsonResponse({}, 404));

      await expect(checkForkBranch({ owner: 'me', repo: 'repo' })).rejects.toThrow(
        'The fork does not have the configured branch',
      );
      expect(_).toHaveBeenCalledWith('open_authoring.fork_branch_missing', {
        values: { fork: 'me/repo', branch: 'main', repo: 'owner/repo' },
      });
    });
  });

  describe('initOpenAuthoring', () => {
    test('leaves a maintainer on the configured repository', async () => {
      vi.mocked(getRepositoryInfo).mockResolvedValue({ permissions: { push: true } });

      await initOpenAuthoring();

      expect(forkedRepository.current).toBeUndefined();
      expect(openAuthoringInitialized.current).toBe(true);
      expect(fetchAPI).not.toHaveBeenCalled();
    });

    test('reuses and syncs an existing fork, once it has the branch', async () => {
      vi.mocked(getRepositoryInfo).mockResolvedValue({ permissions: { pull: true } });
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(
          jsonResponse({
            full_name: 'me/repo',
            owner: { login: 'me' },
            fork: true,
            parent: { full_name: 'owner/repo' },
          }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(jsonResponse({ name: 'main' }));

      await initOpenAuthoring();

      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        '/repos/me/repo/merge-upstream',
        expect.objectContaining({ method: 'POST' }),
      );
      expect(fetchAPI).toHaveBeenNthCalledWith(3, '/repos/me/repo/branches/main', {
        responseType: 'raw',
      });
      expect(forkedRepository.current).toEqual({ owner: 'me', repo: 'repo' });
      expect(openAuthoringInitialized.current).toBe(true);
    });

    test('stops when the fork doesn’t have the configured branch', async () => {
      vi.mocked(getRepositoryInfo).mockResolvedValue({ permissions: { pull: true } });
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(
          jsonResponse({
            full_name: 'me/repo',
            owner: { login: 'me' },
            fork: true,
            parent: { full_name: 'owner/repo' },
          }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(jsonResponse({ message: 'not found' }, 404));

      await expect(initOpenAuthoring()).rejects.toThrow(
        'The fork does not have the configured branch',
      );
      expect(forkedRepository.current).toBeUndefined();
      expect(openAuthoringInitialized.current).toBe(false);
    });

    test('resolves the branch name first when it isn’t configured', async () => {
      repository.branch = undefined;
      vi.mocked(getRepositoryInfo).mockResolvedValue({ permissions: { pull: true } });
      vi.mocked(fetchDefaultBranchName).mockImplementation(async () => {
        repository.branch = 'develop';

        return 'develop';
      });
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(
          jsonResponse({
            full_name: 'me/repo',
            owner: { login: 'me' },
            fork: true,
            parent: { full_name: 'owner/repo' },
          }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }))
        .mockResolvedValueOnce(jsonResponse({ name: 'develop' }));

      await initOpenAuthoring();

      expect(fetchDefaultBranchName).toHaveBeenCalled();
      expect(fetchAPI).toHaveBeenNthCalledWith(
        2,
        '/repos/me/repo/merge-upstream',
        expect.objectContaining({ body: { branch: 'develop' } }),
      );
    });

    test('asks before creating a fork, and creates it when allowed', async () => {
      vi.mocked(getRepositoryInfo).mockResolvedValue({ permissions: { pull: true } });
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(jsonResponse({}, 404))
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ full_name: 'me/repo' });

      const promise = initOpenAuthoring();

      await answerForkRequest(true);
      await promise;

      expect(fetchAPI).toHaveBeenNthCalledWith(3, '/repos/owner/repo/forks', {
        method: 'POST',
        body: {},
      });
      expect(forkedRepository.current).toEqual({ owner: 'me', repo: 'repo' });
      expect(openAuthoringInitialized.current).toBe(true);
    });

    test('says so when Forgejo has forking turned off, without asking', async () => {
      instance.isForgejo = true;
      vi.mocked(getRepositoryInfo).mockResolvedValue({ permissions: { pull: true } });
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(jsonResponse({}, 404))
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ forks_disabled: true });

      await expect(initOpenAuthoring()).rejects.toThrow('The repository does not allow forking');
      expect(forkPermissionRequest.current).toBeUndefined();
      expect(forkedRepository.current).toBeUndefined();
    });

    test('stops when the user declines to fork', async () => {
      vi.mocked(getRepositoryInfo).mockResolvedValue({ permissions: { pull: true } });
      vi.mocked(fetchAPI).mockResolvedValueOnce(jsonResponse({}, 404)).mockResolvedValueOnce({});

      const promise = initOpenAuthoring();

      await answerForkRequest(false);

      await expect(promise).rejects.toThrow('Permission to fork the repository was declined');
      expect(forkedRepository.current).toBeUndefined();
      expect(openAuthoringInitialized.current).toBe(false);
    });
  });
});
