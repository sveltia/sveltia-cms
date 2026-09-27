import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiConfig } from '$lib/services/backends/git/shared/api';
import { initGitBackend } from '$lib/services/backends/git/shared/init';

vi.mock('$lib/services/backends/git/shared/api', () => ({
  apiConfig: {},
}));

vi.mock('$lib/services/user/prefs.svelte', () => ({
  prefs: { devModeEnabled: false },
}));

describe('initGitBackend', () => {
  beforeEach(() => {
    Object.keys(apiConfig).forEach((key) => delete (/** @type {any} */ (apiConfig)[key]));
  });

  it('should fill in the repository info and the API endpoint configuration', () => {
    const repository = /** @type {any} */ ({});
    const getTokenPageURL = vi.fn((repoURL) => `${repoURL}/tokens`);
    const getBaseURLs = vi.fn((repoURL, branch) => ({ treeBaseURL: `${repoURL}/tree/${branch}` }));

    const result = initGitBackend(repository, {
      service: 'gitea',
      label: 'Gitea',
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      restApiRoot: 'https://gitea.example.com/api/v1',
      defaultApiRoot: 'https://gitea.com/api/v1',
      getTokenPageURL,
      getBaseURLs,
      authRoot: 'https://gitea.example.com/',
      authPath: '/login/oauth/authorize/',
      tokenPath: '/access_token',
      api: {
        clientId: 'client-id',
        authScope: 'read:user',
        restBaseURL: 'https://gitea.example.com/api/v1',
        includeCredentials: true,
      },
    });

    expect(result).toBe(repository);
    expect(repository).toEqual({
      service: 'gitea',
      label: 'Gitea',
      owner: 'owner',
      repo: 'repo',
      branch: 'main',
      repoURL: 'https://gitea.example.com/owner/repo',
      tokenPageURL: 'https://gitea.example.com/owner/repo/tokens',
      databaseName: 'gitea:owner/repo',
      isSelfHosted: true,
      treeBaseURL: 'https://gitea.example.com/owner/repo/tree/main',
    });
    expect(apiConfig).toEqual({
      clientId: 'client-id',
      authScope: 'read:user',
      authURL: 'https://gitea.example.com/login/oauth/authorize',
      tokenURL: 'https://gitea.example.com/login/oauth/access_token',
      restBaseURL: 'https://gitea.example.com/api/v1',
      includeCredentials: true,
    });
  });
});
