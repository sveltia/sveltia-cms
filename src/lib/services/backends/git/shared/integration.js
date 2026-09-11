import { backend } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * @import { GitBackend } from '$lib/types/public';
 */

/**
 * Whether the skip CI configuration is explicitly set in the CMS configuration. This is used to
 * determine if the skip CI option should be shown in the UI.
 */
export const skipCIConfigured = createDerivedState(() => {
  const { current: _cmsConfig } = cmsConfig;
  const { current: _backend } = backend;

  if (!_cmsConfig || !_backend?.isGit) {
    return false;
  }

  const { skip_ci: skipCI, automatic_deployments: autoDeploy } = /** @type {GitBackend} */ (
    _cmsConfig.backend
  );

  return typeof skipCI === 'boolean' || typeof autoDeploy === 'boolean';
});

/**
 * Whether the skip CI option is enabled in the CMS configuration.
 */
export const skipCIEnabled = createDerivedState(() => {
  const { current: _cmsConfig } = cmsConfig;
  const { current: _backend } = backend;

  if (!_cmsConfig || !_backend?.isGit) {
    return false;
  }

  const { skip_ci: skipCI, automatic_deployments: autoDeploy } = /** @type {GitBackend} */ (
    _cmsConfig.backend
  );

  return skipCI === true || autoDeploy === false;
});
