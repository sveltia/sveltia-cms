import { stripSlashes } from '@sveltia/utils/string';
import { get } from 'svelte/store';

import { getTokenPageURL, signIn, signOut } from '$lib/services/backends/git/gitlab/auth';
import { commitChanges } from '$lib/services/backends/git/gitlab/commits';
import {
  BACKEND_LABEL,
  BACKEND_NAME,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_PATH,
  DEFAULT_AUTH_ROOT,
} from '$lib/services/backends/git/gitlab/constants';
import { fetchBlob, fetchFiles } from '$lib/services/backends/git/gitlab/files';
import { getBaseURLs, repository } from '$lib/services/backends/git/gitlab/repository';
import { checkStatus, STATUS_DASHBOARD_URL } from '$lib/services/backends/git/gitlab/status';
import { apiConfig, graphqlVars } from '$lib/services/backends/git/shared/api';
import { getRepoURL } from '$lib/services/backends/git/shared/repository';
import { cmsConfig } from '$lib/services/config';
import { prefs } from '$lib/services/user/prefs';

/**
 * @import { ApiEndpointConfig, BackendService, RepositoryInfo } from '$lib/types/private';
 */

/**
 * Initialize the GitLab backend.
 * @returns {RepositoryInfo | undefined} Repository info, or nothing when the configured backend is
 * not GitLab.
 */
export const init = () => {
  const { backend } = get(cmsConfig) ?? {};

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
    // https://HOSTNAME/api/graphql or https://HOSTNAME/PATH/api/graphql
    graphql_api_root: graphqlApiRoot = restApiRoot.replace(/\/api\/.+$/, '/api/graphql'),
  } = backend;

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
      tokenPageURL: getTokenPageURL(repoURL),
      databaseName: `${BACKEND_NAME}:${repoPath}`,
      isSelfHosted: restApiRoot !== DEFAULT_API_ROOT,
    }),
    getBaseURLs(repoURL, branch),
  );

  Object.assign(
    apiConfig,
    /** @type {ApiEndpointConfig} */ ({
      clientId,
      authScope: 'api',
      authURL,
      tokenURL: authURL.replace('/authorize', '/token'),
      authScheme: 'Bearer',
      restBaseURL: stripSlashes(restApiRoot),
      graphqlBaseURL: stripSlashes(graphqlApiRoot),
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
