import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import { signIn, signOut } from '$lib/services/backends/git/github/auth';
import { commitChanges } from '$lib/services/backends/git/github/commits';
import {
  BACKEND_LABEL,
  BACKEND_NAME,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_PATH,
  DEFAULT_AUTH_ROOT,
  DEFAULT_ORIGIN,
} from '$lib/services/backends/git/github/constants';
import { triggerDeployment } from '$lib/services/backends/git/github/deployment';
import { fetchBlob, fetchFiles } from '$lib/services/backends/git/github/files';
import { repository, getBaseURLs } from '$lib/services/backends/git/github/repository';
import { checkStatus, STATUS_DASHBOARD_URL } from '$lib/services/backends/git/github/status';
import { apiConfig, graphqlVars } from '$lib/services/backends/git/shared/api';
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
    api_root: restApiRoot = DEFAULT_API_ROOT,
    graphql_api_root: graphqlApiRoot = restApiRoot,
  } = backend;

  const authURL = `${stripSlashes(authRoot)}/${stripSlashes(authPath)}`;
  // Developers may misconfigure custom API roots, so we use the origin to redefine them
  const restApiOrigin = new URL(restApiRoot).origin;
  const graphqlApiOrigin = new URL(graphqlApiRoot).origin;
  const isSelfHosted = restApiRoot !== DEFAULT_API_ROOT;
  const origin = isSelfHosted ? restApiOrigin : DEFAULT_ORIGIN;
  const [owner, repo] = /** @type {string} */ (projectPath).split('/');
  const repoPath = `${owner}/${repo}`;
  const baseURL = `${origin}/${repoPath}`;

  Object.assign(
    repository,
    /** @type {RepositoryInfo} */ ({
      service: BACKEND_NAME,
      label: BACKEND_LABEL,
      owner,
      repo,
      branch,
      baseURL,
      databaseName: `${BACKEND_NAME}:${repoPath}`,
      isSelfHosted,
    }),
    getBaseURLs(baseURL, branch),
  );

  Object.assign(
    apiConfig,
    /** @type {ApiEndpointConfig} */ ({
      clientId: '', // @todo Implement OAuth token renewal
      authURL,
      tokenURL: authURL.replace('/authorize', '/access_token'),
      origin: restApiOrigin,
      restBaseURL: isSelfHosted ? `${restApiOrigin}/api/v3` : restApiOrigin,
      graphqlBaseURL: isSelfHosted ? `${graphqlApiOrigin}/api` : graphqlApiOrigin,
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
