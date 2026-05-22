import { getDuplicateFiles } from '$lib/services/assets';

/**
 * @import { Asset } from '$lib/types/private';
 */

/**
 * @typedef {object} DuplicatesState
 * @property {number} count Number of duplicate files.
 * @property {string} name Name of the first duplicate file.
 * @property {boolean} showDialog Whether to show the duplicates dialog.
 * @property {(value: boolean | undefined) => void} resolve Function to resolve the promise.
 */

/** @type {DuplicatesState} */
const DEFAULT_STATE = {
  count: 0,
  name: '',
  showDialog: false,
  // eslint-disable-next-line jsdoc/require-jsdoc
  resolve: () => {},
};

/** @type {DuplicatesState} */
export const duplicates = $state({ ...DEFAULT_STATE });

/**
 * Check for duplicate files and ask the user if they want to replace them.
 * @param {object} args Arguments.
 * @param {File[]} args.files File list.
 * @param {Asset[]} args.listedAssets Listed assets.
 * @returns {Promise<boolean | undefined>} `true` if the user chooses to replace the existing file,
 * `false` if not, or `undefined` if the dialog is closed without making a choice. When there are no
 * duplicate files, it returns `false` immediately.
 */
export const checkDuplicates = async ({ files, listedAssets }) => {
  const dupFiles = getDuplicateFiles(files, listedAssets);
  const count = dupFiles.length;

  if (!count) {
    return false;
  }

  const { promise, resolve } = Promise.withResolvers();

  Object.assign(duplicates, {
    count,
    name: dupFiles[0].name,
    showDialog: true,
    resolve,
  });

  const replace = await promise;

  // Reset state
  Object.assign(duplicates, { ...DEFAULT_STATE });

  return replace;
};
