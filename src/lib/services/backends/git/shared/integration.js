import { backend } from '$lib/services/backends';
import { isDeployingCommit } from '$lib/services/backends/git/shared/commits';
import { cmsConfig } from '$lib/services/config';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import { CommitOptions } from '$lib/types/private';
 * @import { GitBackend } from '$lib/types/public';
 */

/**
 * Get the two options that decide whether a commit skips CI, as the configured Git backend sets
 * them.
 * @returns {{ skipCI?: boolean, autoDeploy?: boolean }} Options, both `undefined` when no Git
 * backend is configured, in which case there is no CI to skip.
 */
const getSkipCIOptions = () => {
  const { current: _cmsConfig } = cmsConfig;
  const { current: _backend } = backend;

  if (!_cmsConfig || !_backend?.isGit) {
    return {};
  }

  const { skip_ci: skipCI, automatic_deployments: autoDeploy } = /** @type {GitBackend} */ (
    _cmsConfig.backend
  );

  return { skipCI, autoDeploy };
};

/**
 * Whether the skip CI configuration is explicitly set in the CMS configuration. This is used to
 * determine if the skip CI option should be shown in the UI.
 */
export const skipCIConfigured = createDerivedState(() => {
  const { skipCI, autoDeploy } = getSkipCIOptions();

  return typeof skipCI === 'boolean' || typeof autoDeploy === 'boolean';
});

/**
 * Whether the skip CI option is enabled in the CMS configuration.
 */
export const skipCIEnabled = createDerivedState(() => {
  const { skipCI, autoDeploy } = getSkipCIOptions();

  return skipCI === true || autoDeploy === false;
});

/**
 * Check whether a commit is to be reported as publishing its changes, in a toast after saving. That
 * only applies when the skip CI option is configured; without it, every commit is published, and
 * saying so each time would be noise. See {@link isDeployingCommit}.
 * @param {Partial<CommitOptions>} options Commit options.
 * @returns {boolean} Result.
 */
export const isPublishingCommit = (options) =>
  skipCIConfigured.current && isDeployingCommit(options);
