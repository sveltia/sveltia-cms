import { derived } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { siteConfig } from '$lib/services/config';

/**
 * @import { Readable } from 'svelte/store';
 */

/**
 * Whether the skip CI configuration is explicitly set in the site configuration. This is used to
 * determine if the skip CI option should be shown in the UI.
 * @type {Readable<boolean>}
 */
export const skipCIConfigured = derived([siteConfig, backend], ([_siteConfig, _backend]) => {
  if (!_siteConfig || !_backend?.isGit) {
    return false;
  }

  const {
    backend: { skip_ci: skipCI, automatic_deployments: autoDeployEnabled },
  } = _siteConfig;

  return typeof skipCI === 'boolean' || typeof autoDeployEnabled === 'boolean';
});

/**
 * Whether the skip CI option is enabled in the site configuration.
 * @type {Readable<boolean>}
 */
export const skipCIEnabled = derived([siteConfig, backend], ([_siteConfig, _backend]) => {
  if (!_siteConfig || !_backend?.isGit) {
    return false;
  }

  const {
    backend: { skip_ci: skipCI, automatic_deployments: autoDeployEnabled },
  } = _siteConfig;

  return skipCI === true || autoDeployEnabled === false;
});
