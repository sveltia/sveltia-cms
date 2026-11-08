import local from '$lib/services/backends/fs/local';
import test from '$lib/services/backends/fs/test';
import { gitBackendServices, loadGitBackendService } from '$lib/services/backends/git/services';
import { cmsConfig } from '$lib/services/config';
import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { BackendService } from '$lib/types/private';
 * @import { BackendName } from '$lib/types/public';
 */

/**
 * List of the supported backend services that aren’t Git hosting services.
 * @type {Record<string, BackendService>}
 */
const fileSystemBackendServices = {
  local,
  'test-repo': test,
};

/**
 * Get a backend service that has been loaded. A Git backend service kept in a chunk is only there
 * once it’s been loaded with {@link loadBackendService}.
 * @param {string} name Backend name.
 * @returns {BackendService | undefined} Service.
 * @see https://decapcms.org/docs/backends-overview/
 * @see https://sveltiacms.app/en/docs/backends
 */
const getBackendService = (name) => fileSystemBackendServices[name] ?? gitBackendServices[name];

/**
 * List of backend services that are implemented in Netlify/Decap CMS but are not supported in
 * Sveltia CMS for performance and/or deprecation reasons.
 * @type {Record<string, { label: string, deprecated?: boolean }>}
 * @see https://sveltiacms.app/en/docs/migration/netlify-decap-cms#compatibility
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
export const validBackendNames = /** @type {BackendName[]} */ ([
  ...Object.keys(gitBackendServices),
  'test-repo',
]);

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
  backendName.current ? getBackendService(backendName.current) : undefined,
);

/**
 * Get a backend service, loading it first if it’s kept in a chunk. The local backend wraps the
 * configured Git backend, so that one is loaded along with it.
 * @param {string} name Backend name.
 * @returns {Promise<BackendService | undefined>} Service, or `undefined` if there’s no backend with
 * the name.
 * @throws {Error} If the service can’t be loaded.
 */
export const loadBackendService = async (name) => {
  if (name === 'local') {
    const remoteName = cmsConfig.current?.backend.name;

    if (remoteName) {
      await loadGitBackendService(remoteName);
    }
  }

  return fileSystemBackendServices[name] ?? loadGitBackendService(name);
};

/**
 * Select the backend service with the given name, loading it if needed and initializing it if it’s
 * not the current one.
 * @param {string | undefined} name Backend name, or `undefined` to deselect the current backend.
 * @returns {Promise<BackendService | undefined>} Selected backend service, if any.
 * @throws {Error} If the service can’t be loaded.
 */
export const selectBackend = async (name) => {
  const service = name ? await loadBackendService(name) : undefined;

  if (service && service !== backend.current) {
    service.init();
  }

  backendName.current = name;

  return service;
};
