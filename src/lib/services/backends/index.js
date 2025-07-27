import { derived, writable } from 'svelte/store';

import local from '$lib/services/backends/fs/local';
import test from '$lib/services/backends/fs/test';
import gitea from '$lib/services/backends/git/gitea';
import github from '$lib/services/backends/git/github';
import gitlab from '$lib/services/backends/git/gitlab';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { BackendService } from '$lib/types/private';
 * @import { BackendName } from '$lib/types/public';
 */

/**
 * List of all the supported backend services.
 * @type {Record<string, BackendService>}
 * @see https://decapcms.org/docs/backends-overview/
 */
export const allBackendServices = {
  github,
  gitlab,
  gitea,
  local,
  'test-repo': test,
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
 * Currently selected backend service name.
 * @type {Writable<string | undefined>}
 */
export const backendName = writable();

/**
 * Currently selected backend service.
 * @type {Readable<BackendService | undefined>}
 */
export const backend = derived([backendName], ([name], _set, update) => {
  update((currentService) => {
    const newService = name ? allBackendServices[name] : undefined;

    if (newService && newService !== currentService) {
      newService.init();
    }

    return newService;
  });
});

/**
 * Whether the last commit was published. This is used to determine if the last commit was published
 * to the remote backend. If the last commit was not published, the user will be prompted to publish
 * it.
 * @type {Writable<boolean>}
 */
export const isLastCommitPublished = writable(true);
