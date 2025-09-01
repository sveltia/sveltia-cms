import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { signIn, signOut } from '$lib/services/backends/git/gitea/auth';
import { commitChanges } from '$lib/services/backends/git/gitea/commits';
import {
  BACKEND_LABEL,
  BACKEND_NAME,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_PATH,
  DEFAULT_AUTH_ROOT,
} from '$lib/services/backends/git/gitea/constants';
import { fetchBlob, fetchFiles } from '$lib/services/backends/git/gitea/files';
import { getBaseURLs, getPatURL, repository } from '$lib/services/backends/git/gitea/repository';
import { apiConfig } from '$lib/services/backends/git/shared/api';
import { getRepoURL } from '$lib/services/backends/git/shared/repository';
import { siteConfig } from '$lib/services/config';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { ApiEndpointConfig, BackendService, RepositoryInfo } from '$lib/types/private';
 */

/**
 * Initialize the Gitea/Forgejo backend.
 * @returns {RepositoryInfo | undefined} Repository info, or nothing when the configured backend is
 * not Gitea/Forgejo.
 */
export const init = () => {
  const { backend } = get(siteConfig) ?? {};

  if (backend?.name !== BACKEND_NAME) {
    return undefined;
  }

  const {
    repo: projectPath,
    branch,
    base_url: authRoot = DEFAULT_AUTH_ROOT,
    auth_endpoint: authPath = DEFAULT_AUTH_PATH,
    app_id: clientId = '',
    // https://HOSTNAME/api/v1 or https://HOSTNAME/PATH/api/v1
    api_root: restApiRoot = DEFAULT_API_ROOT,
  } = backend;

  const [owner, repo] = /** @type {string} */ (projectPath).split('/');
  const repoPath = `${owner}/${repo}`;
  const authURL = `${stripSlashes(authRoot)}/${stripSlashes(authPath)}`;
  const repoURL = getRepoURL(restApiRoot, repoPath);

  Object.assign(
    repository,
    /** @type {RepositoryInfo} */ ({
      service: BACKEND_NAME,
      label: BACKEND_LABEL,
      owner,
      repo,
      branch,
      repoURL,
      newPatURL: getPatURL(repoURL),
      databaseName: `${BACKEND_NAME}:${repoPath}`,
      isSelfHosted: restApiRoot !== DEFAULT_API_ROOT,
    }),
    getBaseURLs(repoURL, branch),
  );

  Object.assign(
    apiConfig,
    /** @type {ApiEndpointConfig} */ ({
      clientId,
      authURL,
      tokenURL: authURL.replace('/authorize', '/access_token'),
      restBaseURL: stripSlashes(restApiRoot),
    }),
  );

  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('repositoryInfo', repository);
  }

  return repository;
};

/**
 * @type {BackendService}
 */
export default {
  isGit: true,
  name: BACKEND_NAME,
  label: BACKEND_LABEL,
  repository,
  init,
  signIn,
  signOut,
  fetchFiles,
  fetchBlob,
  commitChanges,
};
