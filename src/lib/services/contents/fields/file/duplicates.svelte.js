import { getDuplicateFiles } from '$lib/services/assets';
import { createRawState, requestAnswer } from '$lib/services/utils/state.svelte';

/**
 * @import { Asset, DuplicatesRequest } from '$lib/types/private';
 */

/**
 * The pending request asking the user what to do with duplicate files, which the UI turns into a
 * conflict resolution dialog. It’s `undefined` while no request is outstanding.
 * @type {{ current: DuplicatesRequest | undefined }}
 */
export const duplicatesRequest = createRawState();

/**
 * Check for duplicate files and ask the user if they want to replace them. An earlier request still
 * waiting for an answer is cancelled.
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

  return requestAnswer(duplicatesRequest, { count, name: dupFiles[0].name }, undefined);
};
