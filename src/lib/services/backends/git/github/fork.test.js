import { _ } from '@sveltia/i18n';
import { get } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  createFork,
  fetchFork,
  fetchForkByName,
  fetchForkFromNetwork,
  fetchRepositoryAccess,
  getWorkflowRepository,
  hasPendingInvitation,
  initOpenAuthoring,
  isOpenAuthoringConfigured,
  syncFork,
  waitForFork,
} from '$lib/services/backends/git/github/fork';
import { fetchDefaultBranchName, repository } from '$lib/services/backends/git/github/repository';
import { fetchAPI, fetchGraphQL } from '$lib/services/backends/git/shared/api';
import { cmsConfig } from '$lib/services/config';
import { user } from '$lib/services/user/account.svelte';
import { forkedRepository, requestForkPermission } from '$lib/services/workflow/open-authoring';

vi.mock('$lib/services/backends/git/github/repository', () => ({
  repository: { owner: 'owner', repo: 'repo', branch: 'main' },
  fetchDefaultBranchName: vi.fn(),
}));
vi.mock('$lib/services/backends/git/shared/api');
vi.mock('@sveltia/i18n', () => ({ _: vi.fn((key) => key) }));
vi.mock('@sveltia/utils/misc', () => ({ sleep: vi.fn() }));
vi.mock('$lib/services/workflow/open-authoring', async (importOriginal) => ({
  .../** @type {object} */ (await importOriginal()),
  requestForkPermission: vi.fn(),
}));

/**
 * Create a stub `Response` for {@link fetchAPI} calls made with the `raw` response type.
 * @param {boolean} ok Whether the request succeeded.
 * @param {any} [body] JSON body to resolve.
 * @param {object} [options] Options.
 * @param {number} [options.status] HTTP status. Defaults to 200 or 403 to match `ok`.
 * @param {Record<string, string>} [options.headers] Response headers.
 * @returns {any} Response-like object.
 */
const createResponse = (ok, body = {}, { status = undefined, headers = {} } = {}) => ({
  ok,
  status: status ?? (ok ? 200 : 403),
  headers: new Headers(headers),
  /**
   * Parse the response body.
   * @returns {Promise<any>} Body.
   */
  json: async () => body,
});

describe('GitHub fork service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    forkedRepository.set(undefined);
    cmsConfig.set(/** @type {any} */ ({ backend: { name: 'github', open_authoring: true } }));
    user.account = /** @type {any} */ ({ login: 'contributor', token: 'token' });
    Object.assign(repository, { owner: 'owner', repo: 'repo', branch: 'main' });
  });

  describe('isOpenAuthoringConfigured', () => {
    test('is on with the GitHub backend option', () => {
      expect(isOpenAuthoringConfigured()).toBe(true);
    });

    test('is off without the option, with another backend, or without a config', () => {
      cmsConfig.set(/** @type {any} */ ({ backend: { name: 'github' } }));
      expect(isOpenAuthoringConfigured()).toBe(false);

      cmsConfig.set(/** @type {any} */ ({ backend: { name: 'gitlab', open_authoring: true } }));
      expect(isOpenAuthoringConfigured()).toBe(false);

      cmsConfig.set(undefined);
      expect(isOpenAuthoringConfigured()).toBe(false);
    });
  });

  describe('getWorkflowRepository', () => {
    test('is the configured repository without a fork', () => {
      expect(getWorkflowRepository()).toEqual({ owner: 'owner', repo: 'repo' });
    });

    test('is the fork once one is set', () => {
      forkedRepository.set({ owner: 'contributor', repo: 'repo' });
      expect(getWorkflowRepository()).toEqual({ owner: 'contributor', repo: 'repo' });
    });
  });

  describe('fetchRepositoryAccess', () => {
    test('reads the signed-in user’s own permissions off the repository', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(true, { permissions: { push: true, admin: false }, allow_forking: true }),
      );

      await expect(fetchRepositoryAccess()).resolves.toEqual({
        canWrite: true,
        allowForking: true,
      });

      // The collaborator endpoint would need administrator access to answer this
      expect(fetchAPI).toHaveBeenCalledWith('/repos/owner/repo', expect.any(Object));
    });

    test('warns when a private personal repository leaves no room for contributors', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(true, {
          permissions: { push: true },
          private: true,
          owner: { type: 'User' },
          allow_forking: true,
        }),
      );

      await fetchRepositoryAccess();

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('owned by a personal account'));
      warn.mockRestore();
    });

    test('stays quiet for a public or organization repository', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      // A public personal repository is fine: contributors there aren’t collaborators at all
      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(true, {
          permissions: { push: true },
          private: false,
          owner: { type: 'User' },
        }),
      );

      await fetchRepositoryAccess();

      // An organization repository has the Read role, so a contributor can exist
      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(true, {
          permissions: { push: false },
          private: true,
          owner: { type: 'Organization' },
        }),
      );

      await fetchRepositoryAccess();

      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    test('is read-only for a contributor', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(true, { permissions: { push: false, pull: true }, allow_forking: true }),
      );

      await expect(fetchRepositoryAccess()).resolves.toEqual({
        canWrite: false,
        allowForking: true,
      });
    });

    test('reports a repository that can’t be forked', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(true, { permissions: { push: false }, allow_forking: false }),
      );

      await expect(fetchRepositoryAccess()).resolves.toEqual({
        canWrite: false,
        allowForking: false,
      });
    });

    test('assumes forking is allowed when the field is absent', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createResponse(true, { permissions: { push: false } }));

      await expect(fetchRepositoryAccess()).resolves.toEqual({
        canWrite: false,
        allowForking: true,
      });
    });

    test('raises when the repository can’t be seen at all', async () => {
      // A private repository answers with a 404 rather than leaking its existence, so a token that
      // can’t read it looks exactly like a missing repository
      vi.mocked(fetchAPI).mockImplementation(async (path) =>
        path === '/user/repository_invitations'
          ? []
          : createResponse(false, {}, { status: 404, headers: { 'x-oauth-scopes': 'repo, user' } }),
      );

      await expect(fetchRepositoryAccess()).rejects.toThrow('No access to the repository');
      expect(_).toHaveBeenCalledWith('repository_no_access', expect.any(Object));
    });

    test('points at a pending invitation when there is one', async () => {
      vi.mocked(fetchAPI).mockImplementation(async (path) =>
        path === '/user/repository_invitations'
          ? [{ repository: { full_name: 'Owner/Repo' } }]
          : createResponse(false, {}, { status: 404 }),
      );

      await expect(fetchRepositoryAccess()).rejects.toThrow('No access to the repository');

      expect(_).toHaveBeenCalledWith(
        'open_authoring.invitation_pending',
        expect.objectContaining({ values: { repo: 'owner/repo' } }),
      );
    });

    test('points at the sign-in scope when it excludes private repositories', async () => {
      // Only a private repository can refuse an authenticated read, so a sign-in that doesn’t
      // cover private repositories is the likely reason rather than the account’s own access
      vi.mocked(fetchAPI).mockImplementation(async (path) =>
        path === '/user/repository_invitations'
          ? []
          : createResponse(
              false,
              {},
              { status: 404, headers: { 'x-oauth-scopes': 'public_repo' } },
            ),
      );

      await expect(fetchRepositoryAccess()).rejects.toThrow('No access to the repository');
      expect(_).toHaveBeenCalledWith(
        'open_authoring.private_repo_scope_required',
        expect.any(Object),
      );
    });

    test('says nothing about the scope when the token doesn’t report one', async () => {
      // A fine-grained token reports its permissions differently and sends no scope header
      vi.mocked(fetchAPI).mockImplementation(async (path) =>
        path === '/user/repository_invitations' ? [] : createResponse(false, {}, { status: 404 }),
      );

      await expect(fetchRepositoryAccess()).rejects.toThrow('No access to the repository');
      expect(_).toHaveBeenCalledWith('repository_no_access', expect.any(Object));
    });

    test('raises rather than guessing when the rate limit is exhausted', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(false, {}, { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
      );

      await expect(fetchRepositoryAccess()).rejects.toThrow(
        'Failed to check the repository permission.',
      );
    });

    test('raises on a secondary rate limit', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createResponse(false, {}, { status: 429 }));

      await expect(fetchRepositoryAccess()).rejects.toThrow(
        'Failed to check the repository permission.',
      );

      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(false, {}, { status: 403, headers: { 'retry-after': '60' } }),
      );

      await expect(fetchRepositoryAccess()).rejects.toThrow(
        'Failed to check the repository permission.',
      );
    });

    test('raises when the service is having trouble', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createResponse(false, {}, { status: 500 }));

      await expect(fetchRepositoryAccess()).rejects.toThrow(
        'Failed to check the repository permission.',
      );
    });
  });

  describe('hasPendingInvitation', () => {
    test('is false when the invitation list can’t be read', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Forbidden'));
      await expect(hasPendingInvitation()).resolves.toBe(false);
    });

    test('ignores an invitation to another repository', async () => {
      vi.mocked(fetchAPI).mockResolvedValue([{ repository: { full_name: 'someone/else' } }, {}]);
      await expect(hasPendingInvitation()).resolves.toBe(false);
    });
  });

  describe('fetchForkByName', () => {
    test('finds the fork on the user’s account', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(true, {
          fork: true,
          full_name: 'contributor/repo',
          parent: { full_name: 'Owner/Repo' },
        }),
      );

      await expect(fetchForkByName()).resolves.toEqual({ owner: 'contributor', repo: 'repo' });
      expect(fetchAPI).toHaveBeenCalledWith('/repos/contributor/repo', expect.any(Object));
    });

    test('returns nothing when there is no such repository', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createResponse(false));
      await expect(fetchForkByName()).resolves.toBeUndefined();
    });

    test('ignores a repository that isn’t a fork of the configured one', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(true, { fork: false, full_name: 'contributor/repo' }),
      );

      await expect(fetchForkByName()).resolves.toBeUndefined();

      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(true, {
          fork: true,
          full_name: 'contributor/repo',
          parent: { full_name: 'someone/else' },
        }),
      );

      await expect(fetchForkByName()).resolves.toBeUndefined();
    });
  });

  describe('fetchForkFromNetwork', () => {
    test('finds a fork the contributor renamed', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          forks: {
            nodes: [{ nameWithOwner: 'contributor/renamed', owner: { login: 'contributor' } }],
          },
        },
      });

      await expect(fetchForkFromNetwork()).resolves.toEqual({
        owner: 'contributor',
        repo: 'renamed',
      });
    });

    test('ignores a fork owned by someone else', async () => {
      // The owner is checked rather than the filter trusted, so a fork that isn’t theirs can’t be
      // committed to by mistake
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          forks: { nodes: [{ nameWithOwner: 'someone/else', owner: { login: 'someone' } }] },
        },
      });

      await expect(fetchForkFromNetwork()).resolves.toBeUndefined();
    });

    test('returns nothing when there are no forks, or the query fails', async () => {
      vi.mocked(fetchGraphQL).mockResolvedValue({ repository: { forks: { nodes: [] } } });
      await expect(fetchForkFromNetwork()).resolves.toBeUndefined();

      vi.mocked(fetchGraphQL).mockResolvedValue({});
      await expect(fetchForkFromNetwork()).resolves.toBeUndefined();

      vi.mocked(fetchGraphQL).mockRejectedValue(new Error('Bad request'));
      await expect(fetchForkFromNetwork()).resolves.toBeUndefined();
    });
  });

  describe('fetchFork', () => {
    test('falls back to the network lookup when the conventional name is empty', async () => {
      // GitHub adds a suffix when the name is taken, and forks can be renamed, so the conventional
      // location isn’t always where it is
      vi.mocked(fetchAPI).mockResolvedValue(createResponse(false, {}, { status: 404 }));
      vi.mocked(fetchGraphQL).mockResolvedValue({
        repository: {
          forks: {
            nodes: [{ nameWithOwner: 'contributor/repo-1', owner: { login: 'contributor' } }],
          },
        },
      });

      await expect(fetchFork()).resolves.toEqual({ owner: 'contributor', repo: 'repo-1' });
    });

    test('skips the network lookup when the fork is where it should be', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(true, {
          fork: true,
          full_name: 'contributor/repo',
          parent: { full_name: 'owner/repo' },
        }),
      );

      await expect(fetchFork()).resolves.toEqual({ owner: 'contributor', repo: 'repo' });
      expect(fetchGraphQL).not.toHaveBeenCalled();
    });
  });

  describe('waitForFork', () => {
    test('returns as soon as the fork can be read', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createResponse(true));

      await expect(waitForFork({ owner: 'contributor', repo: 'repo' })).resolves.toBeUndefined();
      expect(fetchAPI).toHaveBeenCalledTimes(1);
    });

    test('polls until the fork appears', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(createResponse(false))
        .mockResolvedValueOnce(createResponse(true));

      await waitForFork({ owner: 'contributor', repo: 'repo' });
      expect(fetchAPI).toHaveBeenCalledTimes(2);
    });

    test('gives up after the last attempt', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createResponse(false));

      await expect(waitForFork({ owner: 'contributor', repo: 'repo' }, 2)).rejects.toThrow(
        'Timed out waiting for the fork to be created.',
      );

      expect(fetchAPI).toHaveBeenCalledTimes(2);
    });
  });

  describe('createFork', () => {
    test('forks the repository and waits for it', async () => {
      vi.mocked(fetchAPI)
        .mockResolvedValueOnce({ full_name: 'contributor/repo' })
        .mockResolvedValueOnce(createResponse(true));

      await expect(createFork()).resolves.toEqual({ owner: 'contributor', repo: 'repo' });

      expect(fetchAPI).toHaveBeenNthCalledWith(1, '/repos/owner/repo/forks', { method: 'POST' });
    });

    test('reports a failed request', async () => {
      vi.mocked(fetchAPI).mockRejectedValue(new Error('Forbidden'));

      await expect(createFork()).rejects.toThrow('Failed to fork the repository.');
    });
  });

  describe('syncFork', () => {
    test('merges the upstream branch into the fork', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(createResponse(true));

      await syncFork({ owner: 'contributor', repo: 'repo' });

      expect(fetchAPI).toHaveBeenCalledWith(
        '/repos/contributor/repo/merge-upstream',
        expect.objectContaining({ method: 'POST', body: { branch: 'main' } }),
      );
    });

    test('logs a fork that can’t be fast-forwarded', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      vi.mocked(fetchAPI).mockResolvedValue(createResponse(false));

      await expect(syncFork({ owner: 'contributor', repo: 'repo' })).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    test('logs a failure rather than raising it', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      vi.mocked(fetchAPI).mockRejectedValue(new Error('Conflict'));

      await expect(syncFork({ owner: 'contributor', repo: 'repo' })).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('initOpenAuthoring', () => {
    test('leaves a maintainer on the configured repository', async () => {
      vi.mocked(fetchAPI).mockResolvedValue(
        createResponse(true, { permissions: { push: true }, allow_forking: true }),
      );

      await initOpenAuthoring();

      expect(get(forkedRepository)).toBeUndefined();
      expect(requestForkPermission).not.toHaveBeenCalled();
    });

    test('reuses and syncs an existing fork', async () => {
      vi.mocked(fetchAPI)
        // Permission check
        .mockResolvedValueOnce(
          createResponse(true, { permissions: { push: false }, allow_forking: true }),
        )
        // Fork lookup
        .mockResolvedValueOnce(
          createResponse(true, {
            fork: true,
            full_name: 'contributor/repo',
            parent: { full_name: 'owner/repo' },
          }),
        )
        // Upstream sync
        .mockResolvedValueOnce(createResponse(true));

      await initOpenAuthoring();

      expect(get(forkedRepository)).toEqual({ owner: 'contributor', repo: 'repo' });
      expect(requestForkPermission).not.toHaveBeenCalled();
      expect(fetchAPI).toHaveBeenNthCalledWith(
        3,
        '/repos/contributor/repo/merge-upstream',
        expect.any(Object),
      );
    });

    test('resolves the branch name before syncing the fork', async () => {
      Object.assign(repository, { branch: undefined });

      vi.mocked(fetchDefaultBranchName).mockImplementation(async () => {
        Object.assign(repository, { branch: 'trunk' });

        return 'trunk';
      });

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(
          createResponse(true, { permissions: { push: false }, allow_forking: true }),
        )
        .mockResolvedValueOnce(
          createResponse(true, {
            fork: true,
            full_name: 'contributor/repo',
            parent: { full_name: 'owner/repo' },
          }),
        )
        .mockResolvedValueOnce(createResponse(true));

      await initOpenAuthoring();

      expect(fetchDefaultBranchName).toHaveBeenCalled();
      expect(fetchAPI).toHaveBeenNthCalledWith(
        3,
        '/repos/contributor/repo/merge-upstream',
        expect.objectContaining({ body: { branch: 'trunk' } }),
      );
    });

    test('asks for permission and creates a fork when there is none', async () => {
      vi.mocked(requestForkPermission).mockResolvedValue(true);

      vi.mocked(fetchAPI)
        // Permission check
        .mockResolvedValueOnce(
          createResponse(true, { permissions: { push: false }, allow_forking: true }),
        )
        // Fork lookup
        .mockResolvedValueOnce(createResponse(false))
        // Fork creation
        .mockResolvedValueOnce({ full_name: 'contributor/repo' })
        // Polling
        .mockResolvedValueOnce(createResponse(true));

      await initOpenAuthoring();

      expect(requestForkPermission).toHaveBeenCalledWith('owner/repo');
      expect(get(forkedRepository)).toEqual({ owner: 'contributor', repo: 'repo' });
    });

    test('stops when the repository doesn’t allow forking', async () => {
      vi.mocked(fetchAPI)
        // Access check: read-only, and forking turned off, as a private repository is by default
        .mockResolvedValueOnce(
          createResponse(true, { permissions: { push: false }, allow_forking: false }),
        )
        // Fork lookup
        .mockResolvedValueOnce(createResponse(false, {}, { status: 404 }));

      await expect(initOpenAuthoring()).rejects.toThrow('The repository does not allow forking');

      // The user isn’t asked for permission to do something that can’t succeed
      expect(requestForkPermission).not.toHaveBeenCalled();
    });

    test('stops when the user declines the fork', async () => {
      vi.mocked(requestForkPermission).mockResolvedValue(false);

      vi.mocked(fetchAPI)
        .mockResolvedValueOnce(
          createResponse(true, { permissions: { push: false }, allow_forking: true }),
        )
        .mockResolvedValueOnce(createResponse(false));

      await expect(initOpenAuthoring()).rejects.toThrow(
        'Permission to fork the repository was declined',
      );

      expect(get(forkedRepository)).toBeUndefined();
    });
  });
});
