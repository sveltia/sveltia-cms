import { backend } from '$lib/services/backends';
import { isDeployingCommit } from '$lib/services/backends/git/shared/commits';
import { cmsConfig } from '$lib/services/config';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import { CommitOptions } from '$lib/types/private';
 * @import { GitBackend } from '$lib/types/public';
 */

/**
 * Get the `skip_ci` option of the configured Git backend.
 * @returns {boolean | undefined} Option value, `undefined` when no Git backend is configured, in
 * which case there is no CI to skip.
 */
const getSkipCIOption = () => {
  const { current: _cmsConfig } = cmsConfig;
  const { current: _backend } = backend;

  if (!_cmsConfig || !_backend?.isGit) {
    return undefined;
  }

  return /** @type {GitBackend} */ (_cmsConfig.backend).skip_ci;
};

/**
 * Whether the skip CI configuration is explicitly set in the CMS configuration. This is used to
 * determine if the skip CI option should be shown in the UI.
 */
export const skipCIConfigured = createDerivedState(() => typeof getSkipCIOption() === 'boolean');

/**
 * Whether the skip CI option is enabled in the CMS configuration.
 */
export const skipCIEnabled = createDerivedState(() => getSkipCIOption() === true);

/**
 * Check whether a commit is to be reported as publishing its changes, in a toast after saving. That
 * only applies when the skip CI option is configured; without it, every commit is published, and
 * saying so each time would be noise. See {@link isDeployingCommit}.
 * @param {Partial<CommitOptions>} options Commit options.
 * @returns {boolean} Result.
 */
export const isPublishingCommit = (options) =>
  skipCIConfigured.current && isDeployingCommit(options);
