import local from '$lib/services/backends/fs/local';
import test from '$lib/services/backends/fs/test';
import gitea from '$lib/services/backends/git/gitea';
import github from '$lib/services/backends/git/github';
import gitlab from '$lib/services/backends/git/gitlab';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { BackendService } from '$lib/types/private';
 * @import { BackendName } from '$lib/types/public';
 */

/**
 * List of all the supported backend services.
 * @type {Record<string, BackendService>}
 * @see https://decapcms.org/docs/backends-overview/
 * @see https://sveltiacms.app/en/docs/backends
 */
export const allBackendServices = {
  github,
  gitlab,
  gitea,
  local,
  'test-repo': test,
};

/**
 * List of backend services that are implemented in Netlify/Decap CMS but are not supported in
 * Sveltia CMS for performance and/or deprecation reasons.
 * @type {Record<string, { label: string, deprecated?: boolean }>}
 * @see https://sveltiacms.app/en/docs/migration/netlify-decap-cms#features-not-to-be-implemented
 */
export const unsupportedBackends = {
  azure: { label: 'Azure DevOps' },
  bitbucket: { label: 'Bitbucket' },
  'git-gateway': { label: 'Git Gateway', deprecated: true },
};

/**
 * List of valid backend service names. This is used to validate the backend name in the site
 * configuration. Note that the `local` backend is not included here, as it’s a special case that
 * requires a Git backend service to be configured.
 * @type {BackendName[]}
 */
export const validBackendNames = /** @type {BackendName[]} */ (
  Object.keys(allBackendServices).filter((name) => name !== 'local')
);

/**
 * List of all the Git backend services.
 * @type {Record<string, BackendService>}
 */
export const gitBackendServices = Object.fromEntries(
  Object.entries(allBackendServices).filter(([, service]) => service.isGit),
);

/**
 * Currently selected backend service name. Use {@link selectBackend} to change it, so that the new
 * service is initialized.
 * @type {{ current: string | undefined }}
 */
export const backendName = createRawState();

/**
 * Currently selected backend service.
 */
export const backend = createDerivedState(() =>
  backendName.current ? allBackendServices[backendName.current] : undefined,
);

/**
 * Select the backend service with the given name, initializing it if it’s not the current one.
 * @param {string | undefined} name Backend name, or `undefined` to deselect the current backend.
 * @returns {BackendService | undefined} Selected backend service, if any.
 */
export const selectBackend = (name) => {
  const service = name ? allBackendServices[name] : undefined;

  if (service && service !== backend.current) {
    service.init();
  }

  backendName.current = name;

  return service;
};
