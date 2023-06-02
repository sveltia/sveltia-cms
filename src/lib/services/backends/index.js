import { writable } from 'svelte/store';
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
 * @type {import('svelte/store').Writable<BackendService>}
 */
export const backend = writable();
