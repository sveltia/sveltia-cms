import { writable } from 'svelte/store';
import github from '$lib/services/backends/github';
import local from '$lib/services/backends/local';

/**
 * List of all the supported backend services.
 * @see https://www.netlifycms.org/docs/backends-overview/
 */
export const allBackendServices = {
  github,
  local,
};

export const backend = writable();
