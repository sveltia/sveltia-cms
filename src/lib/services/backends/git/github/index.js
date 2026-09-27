import {
  normalizeGraphQLBaseURL,
  normalizeRestBaseURL,
} from '$lib/services/backends/git/github/api';
import { getTokenPageURL, signIn, signOut } from '$lib/services/backends/git/github/auth';
import {
  commitChanges,
  fetchFileCommits,
  fetchLastCommit,
} from '$lib/services/backends/git/github/commits';
import {
  BACKEND_LABEL,
  BACKEND_NAME,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_PATH,
  DEFAULT_AUTH_ROOT,
  DEFAULT_PKCE_AUTH_PATH,
  DEFAULT_PKCE_AUTH_ROOT,
} from '$lib/services/backends/git/github/constants';
import {
  fetchBranchHeadSHA,
  fetchDeployments,
  triggerDeployment,
} from '$lib/services/backends/git/github/deployment';
import { fetchBlob, fetchFiles } from '$lib/services/backends/git/github/files';
import { getBaseURLs, repository } from '$lib/services/backends/git/github/repository';
import { checkStatus, STATUS_DASHBOARD_URL } from '$lib/services/backends/git/github/status';
import workflow from '$lib/services/backends/git/github/workflow';
import { graphqlVars } from '$lib/services/backends/git/shared/api';
import { initGitBackend } from '$lib/services/backends/git/shared/init';
import { cmsConfig } from '$lib/services/config';

/**
 * @import { BackendService, RepositoryInfo } from '$lib/types/private';
 */

/**
 * Initialize the GitHub backend.
 * @returns {RepositoryInfo | undefined} Repository info, or nothing when the configured backend is
 * not GitHub.
 */
export const init = () => {
  const { backend } = cmsConfig.current ?? {};

  if (backend?.name !== BACKEND_NAME) {
    return undefined;
  }

  const {
    repo: projectPath,
    branch,
    auth_type: authType = '',
    // @ts-ignore PKCE is not yet supported
    base_url: authRoot = authType === 'pkce' ? DEFAULT_PKCE_AUTH_ROOT : DEFAULT_AUTH_ROOT,
    // @ts-ignore PKCE is not yet supported
    auth_endpoint: authPath = authType === 'pkce' ? DEFAULT_PKCE_AUTH_PATH : DEFAULT_AUTH_PATH,
    app_id: clientId = '',
    // GitHub Enterprise Server: https://HOSTNAME/api/v3
    api_root: restApiRoot = DEFAULT_API_ROOT,
    // GitHub Enterprise Server: https://HOSTNAME/api/graphql
    graphql_api_root: graphqlApiRoot = restApiRoot,
    include_credentials: includeCredentials = false,
    // Open Authoring on a public repository only needs `public_repo`, which is a narrower grant to
    // ask a contributor for than full `repo` access
    auth_scope: authScope = 'repo',
  } = backend;

  const [owner, repo] = /** @type {string} */ (projectPath).split('/');

  initGitBackend(repository, {
    service: BACKEND_NAME,
    label: BACKEND_LABEL,
    owner,
    repo,
    branch,
    restApiRoot,
    defaultApiRoot: DEFAULT_API_ROOT,
    getTokenPageURL,
    getBaseURLs,
    authRoot,
    authPath,
    tokenPath: '/access_token',
    api: {
      clientId,
      authScope: `${authScope},user`,
      restBaseURL: normalizeRestBaseURL(restApiRoot),
      graphqlBaseURL: normalizeGraphQLBaseURL(graphqlApiRoot),
      includeCredentials,
    },
  });

  Object.assign(graphqlVars, { owner, repo, branch });

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
  fetchLastCommit,
  fetchBlob,
  commitChanges,
  fetchFileCommits,
  triggerDeployment,
  fetchBranchHeadSHA,
  fetchDeployments,
  workflow,
};
