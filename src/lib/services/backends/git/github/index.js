import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import {
  normalizeGraphQLBaseURL,
  normalizeRestBaseURL,
} from '$lib/services/backends/git/github/api';
import { signIn, signOut } from '$lib/services/backends/git/github/auth';
import { commitChanges } from '$lib/services/backends/git/github/commits';
import {
  BACKEND_LABEL,
  BACKEND_NAME,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_PATH,
  DEFAULT_AUTH_ROOT,
} from '$lib/services/backends/git/github/constants';
import { triggerDeployment } from '$lib/services/backends/git/github/deployment';
import { fetchBlob, fetchFiles } from '$lib/services/backends/git/github/files';
import { getBaseURLs, repository } from '$lib/services/backends/git/github/repository';
import { checkStatus, STATUS_DASHBOARD_URL } from '$lib/services/backends/git/github/status';
import { apiConfig, graphqlVars } from '$lib/services/backends/git/shared/api';
import { getRepoURL } from '$lib/services/backends/git/shared/repository';
import { siteConfig } from '$lib/services/config';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { ApiEndpointConfig, BackendService, RepositoryInfo } from '$lib/types/private';
 */

/**
 * Initialize the GitHub backend.
 * @returns {RepositoryInfo | undefined} Repository info, or nothing when the configured backend is
 * not GitHub.
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
    // GitHub Enterprise Server: https://HOSTNAME/api/v3
    api_root: restApiRoot = DEFAULT_API_ROOT,
    // GitHub Enterprise Server: https://HOSTNAME/api/graphql
    graphql_api_root: graphqlApiRoot = restApiRoot,
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
      databaseName: `${BACKEND_NAME}:${repoPath}`,
      isSelfHosted: restApiRoot !== DEFAULT_API_ROOT,
    }),
    getBaseURLs(repoURL, branch),
  );

  Object.assign(
    apiConfig,
    /** @type {ApiEndpointConfig} */ ({
      clientId: '', // @todo Implement OAuth token renewal
      authURL,
      tokenURL: authURL.replace('/authorize', '/access_token'),
      restBaseURL: normalizeRestBaseURL(restApiRoot),
      graphqlBaseURL: normalizeGraphQLBaseURL(graphqlApiRoot),
    }),
  );

  Object.assign(graphqlVars, { owner, repo, branch });

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
  statusDashboardURL: STATUS_DASHBOARD_URL,
  checkStatus,
  init,
  signIn,
  signOut,
  fetchFiles,
  fetchBlob,
  commitChanges,
  triggerDeployment,
};
