import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { BaseConfigListItem } from '$lib/types/private';
 */

/**
 * Regular expression to match Git configuration files.
 * @type {RegExp}
 */
export const GIT_CONFIG_FILE_REGEX = /^(?:.+\/)?(\.git(?:attributes|ignore|keep))$/;

/**
 * List of Git configuration files in the repository that we need, such as `.gitattributes`,
 * `.gitkeep`, etc. `.gitkeep` is not technically a config file, but it’s used to keep an empty
 * directory in the repository, which is needed to create a new asset folder in the CMS.
 * @type {{ current: BaseConfigListItem[] }}
 */
export const gitConfigFiles = createRawState([]);

/**
 * File extensions that are tracked by Git LFS. This is derived from the `.gitattributes` file in
 * the repository, if it exists.
 */
export const lfsFileExtensions = createDerivedState(
  () =>
    gitConfigFiles.current
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
