import { derived } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { cmsConfig } from '$lib/services/config';

/**
 * @import { Readable } from 'svelte/store';
 * @import { GitBackend } from '$lib/types/public';
 */

/**
 * Whether the skip CI configuration is explicitly set in the CMS configuration. This is used to
 * determine if the skip CI option should be shown in the UI.
 * @type {Readable<boolean>}
 */
export const skipCIConfigured = derived([cmsConfig, backend], ([_cmsConfig, _backend]) => {
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
 * @type {Readable<boolean>}
 */
export const skipCIEnabled = derived([cmsConfig, backend], ([_cmsConfig, _backend]) => {
  if (!_cmsConfig || !_backend?.isGit) {
    return false;
  }

  const { skip_ci: skipCI, automatic_deployments: autoDeploy } = /** @type {GitBackend} */ (
    _cmsConfig.backend
  );

  return skipCI === true || autoDeploy === false;
});
