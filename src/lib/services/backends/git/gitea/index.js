import { stripSlashes } from '@sveltia/utils/string';

import { getTokenPageURL, signIn, signOut } from '$lib/services/backends/git/gitea/auth';
import {
  commitChanges,
  fetchFileCommits,
  fetchLastCommit,
} from '$lib/services/backends/git/gitea/commits';
import { getAuthRoot } from '$lib/services/backends/git/gitea/config';
import {
  BACKEND_LABEL,
  BACKEND_NAME,
  BACKEND_NAMES,
  DEFAULT_API_ROOT,
  DEFAULT_AUTH_PATH,
  FORGEJO_BACKEND_LABEL,
  FORGEJO_BACKEND_NAME,
} from '$lib/services/backends/git/gitea/constants';
import { fetchBranchHeadSHA, fetchDeployments } from '$lib/services/backends/git/gitea/deployment';
import { fetchBlob, fetchDirSHA, fetchFiles } from '$lib/services/backends/git/gitea/files';
import { getBaseURLs, repository } from '$lib/services/backends/git/gitea/repository';
import workflow from '$lib/services/backends/git/gitea/workflow';
import { initGitBackend } from '$lib/services/backends/git/shared/init';
import { cmsConfig } from '$lib/services/config';
import { isWorkflowConfigured } from '$lib/services/workflow/config';

/**
 * @import { BackendService, RepositoryInfo } from '$lib/types/private';
 * @import { ForgejoBackend, GiteaBackend } from '$lib/types/public';
 */

/**
 * Initialize the Gitea/Forgejo backend, configured as either the `gitea` or `forgejo` backend.
 * @returns {RepositoryInfo | undefined} Repository info, or nothing when the configured backend is
 * not Gitea/Forgejo.
 */
export const init = () => {
  const { backend } = cmsConfig.current ?? {};

  if (!backend || !BACKEND_NAMES.includes(backend.name)) {
    return undefined;
  }

  const options = /** @type {GiteaBackend | ForgejoBackend} */ (backend);

  const {
    name: service,
    repo: projectPath,
    branch,
    auth_endpoint: authPath = DEFAULT_AUTH_PATH,
    app_id: clientId = '',
    // https://HOSTNAME/api/v1 or https://HOSTNAME/PATH/api/v1
    api_root: restApiRoot = DEFAULT_API_ROOT,
    include_credentials: includeCredentials = false,
  } = options;

  const [owner, repo] = /** @type {string} */ (projectPath).split('/');

  initGitBackend(repository, {
    service,
    label: service === FORGEJO_BACKEND_NAME ? FORGEJO_BACKEND_LABEL : BACKEND_LABEL,
    owner,
    repo,
    branch,
    restApiRoot,
    defaultApiRoot: DEFAULT_API_ROOT,
    getTokenPageURL,
    getBaseURLs,
    authRoot: getAuthRoot(options),
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
const gitea = {
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
  fetchDirSHA,
  commitChanges,
  fetchFileCommits,
  fetchBranchHeadSHA,
  fetchDeployments,
  workflow,
};

/**
 * The same service under the name of the Forgejo backend introduced in Decap CMS 3.15, so its
 * configuration works unchanged.
 * @type {BackendService}
 */
export const forgejo = { ...gitea, name: FORGEJO_BACKEND_NAME, label: FORGEJO_BACKEND_LABEL };

export default gitea;
