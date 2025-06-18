import { derived, writable } from 'svelte/store';
import gitea from '$lib/services/backends/gitea';
import github from '$lib/services/backends/github';
import gitlab from '$lib/services/backends/gitlab';
import local from '$lib/services/backends/local';
import test from '$lib/services/backends/test';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { BackendService, BaseConfigListItem } from '$lib/types/private';
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

/**
 * Regular expression to match Git configuration files.
 * @type {RegExp}
 */
export const GIT_CONFIG_FILE_REGEX = /^(?:.+\/)?(\.git(?:attributes|ignore|keep))$/;

/**
 * List of Git configuration files in the repository that we need, such as `.gitattributes`,
 * `.gitkeep`, etc. `.gitkeep` is not technically a config file, but it’s used to keep an empty
 * directory in the repository, which is needed to create a new asset folder in the CMS.
 * @type {Writable<BaseConfigListItem[]>}
 */
export const gitConfigFiles = writable([]);

/**
 * File extensions that are tracked by Git LFS. This is derived from the `.gitattributes` file in
 * the repository, if it exists.
 * @type {Readable<string[]>}
 */
export const lfsFileExtensions = derived(
  gitConfigFiles,
  (files) =>
    files
      .find(({ path }) => path === '.gitattributes')
      ?.text?.replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) =>
        line.startsWith('*.') && line.includes('filter=lfs')
          ? line.split(' ')[0].slice(2).toLowerCase()
          : '',
      )
      .filter(Boolean) ?? [],
);
