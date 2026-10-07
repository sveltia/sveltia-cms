import { stripSlashes } from '@sveltia/utils/string';

import { getTokenPageURL, signIn, signOut } from '$lib/services/backends/git/gitea/auth';
import {
  commitChanges,
  fetchFileCommits,
  fetchLastCommit,
} from '$lib/services/backends/git/gitea/commits';
import {
  BACKEND_LABEL,
  BACKEND_NAME,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_PATH,
  DEFAULT_AUTH_ROOT,
} from '$lib/services/backends/git/gitea/constants';
import { fetchBlob, fetchFiles } from '$lib/services/backends/git/gitea/files';
import { getBaseURLs, repository } from '$lib/services/backends/git/gitea/repository';
import workflow from '$lib/services/backends/git/gitea/workflow';
import { initGitBackend } from '$lib/services/backends/git/shared/init';
import { cmsConfig } from '$lib/services/config';
import { isWorkflowConfigured } from '$lib/services/workflow/config';

/**
 * @import { BackendService, RepositoryInfo } from '$lib/types/private';
 */

/**
 * Initialize the Gitea/Forgejo backend.
 * @returns {RepositoryInfo | undefined} Repository info, or nothing when the configured backend is
 * not Gitea/Forgejo.
 */
export const init = () => {
  const { backend } = cmsConfig.current ?? {};

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
    include_credentials: includeCredentials = false,
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
      // Editorial Workflow stores the status of an unpublished entry as a label on the pull
      // request, and labels live under the issue scope. It’s only requested when the feature is
      // enabled — which a single collection can do on its own — so a regular setup doesn’t have to
      // ask for more than it uses
      authScope: [
        'read:repository',
        'write:repository',
        ...(isWorkflowConfigured(cmsConfig.current) ? ['read:issue', 'write:issue'] : []),
        'read:user',
      ].join(','),
      restBaseURL: stripSlashes(restApiRoot),
      includeCredentials,
    },
  });

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
  fetchLastCommit,
  fetchBlob,
  commitChanges,
  fetchFileCommits,
  workflow,
};
