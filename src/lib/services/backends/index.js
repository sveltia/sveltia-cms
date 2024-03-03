import { derived, writable } from 'svelte/store';
import github from '$lib/services/backends/github';
import local from '$lib/services/backends/local';

/**
 * List of all the supported backend services.
 * @type {{ [name: string]: BackendService }}
 * @see https://decapcms.org/docs/backends-overview/
 */
export const allBackendServices = {
  github,
  local,
};

/**
 * @type {import('svelte/store').Writable<string | undefined>}
 */
export const backendName = writable();

/**
 * @type {import('svelte/store').Readable<BackendService | undefined>}
 */
export const backend = derived([backendName], ([name], set) => {
  const service = name ? allBackendServices[name] : undefined;

  service?.init();
  set(service);
});
