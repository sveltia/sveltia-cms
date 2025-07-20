import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import { signIn, signOut } from '$lib/services/backends/gitlab/auth';
import { commitChanges } from '$lib/services/backends/gitlab/commits';
import {
  BACKEND_LABEL,
  BACKEND_NAME,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_PATH,
  DEFAULT_AUTH_ROOT,
} from '$lib/services/backends/gitlab/constants';
import { fetchBlob, fetchFiles } from '$lib/services/backends/gitlab/files';
import { repository, getBaseURLs } from '$lib/services/backends/gitlab/repository';
import { checkStatus, STATUS_DASHBOARD_URL } from '$lib/services/backends/gitlab/status';
import { apiConfig, graphqlVars } from '$lib/services/backends/shared/api';
import { siteConfig } from '$lib/services/config';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { ApiEndpointConfig, BackendService, RepositoryInfo } from '$lib/types/private';
 */

/**
 * Initialize the GitLab backend.
 * @returns {RepositoryInfo | undefined} Repository info, or nothing when the configured backend is
 * not GitLab.
 */
const init = () => {
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
    api_root: restApiRoot = DEFAULT_API_ROOT,
    graphql_api_root: graphqlApiRoot = restApiRoot,
  } = backend;

  const authURL = `${stripSlashes(authRoot)}/${stripSlashes(authPath)}`;
  // Developers may misconfigure custom API roots, so we use the origin to redefine them
  const restApiOrigin = new URL(restApiRoot).origin;
  const graphqlApiOrigin = new URL(graphqlApiRoot).origin;

  /**
   * In GitLab terminology, an owner is called a namespace, and a repository is called a project. A
   * namespace can contain a group and a subgroup concatenated with a `/` so we cannot simply use
   * `split('/')` here. A project name should not contain a `/`.
   * @see https://docs.gitlab.com/user/namespace/
   * @see https://gitlab.com/gitlab-org/gitlab/-/merge_requests/80055
   */
  const { owner, repo } =
    /** @type {string} */ (projectPath).match(/(?<owner>.+)\/(?<repo>[^/]+)$/)?.groups ?? {};

  const repoPath = `${owner}/${repo}`;
  const baseURL = `${restApiOrigin}/${repoPath}`;

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
      isSelfHosted: restApiRoot !== DEFAULT_API_ROOT,
    }),
    getBaseURLs(baseURL, branch),
  );

  Object.assign(
    apiConfig,
    /** @type {ApiEndpointConfig} */ ({
      clientId,
      authURL,
      tokenURL: authURL.replace('/authorize', '/token'),
      authScheme: 'Bearer',
      origin: restApiOrigin,
      restBaseURL: `${restApiOrigin}/api/v4`,
      graphqlBaseURL: `${graphqlApiOrigin}/api`,
    }),
  );

  Object.assign(graphqlVars, {
    fullPath: repoPath,
    branch,
  });

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
};
