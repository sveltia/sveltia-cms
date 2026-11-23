import { getDuplicateFiles } from '$lib/services/assets';
import { foldFileName, getGitHash } from '$lib/services/utils/file';
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
 * The files of the latest duplicate check being read, which a newer check waits for, so that the
 * requests are posted in the order the checks started.
 * @type {Promise<unknown>}
 */
let lastCheck = Promise.resolve();

/**
 * Get the files whose names are taken by the listed assets, leaving out a file identical to the
 * asset it shares a name with. That isn’t a conflict: the existing asset is selected instead of
 * uploading the same file again.
 * @param {File[]} files File list.
 * @param {Asset[]} listedAssets Listed assets.
 * @returns {Promise<File[]>} Files with a conflicting name.
 */
const getConflictingFiles = async (files, listedAssets) =>
  (
    await Promise.all(
      getDuplicateFiles(files, listedAssets).map(async (file) => {
        const name = foldFileName(file.name);
        /** @type {string | undefined} */
        let sha;

        try {
          sha = await getGitHash(file);
        } catch {
          // The file can’t be read any more; it’s reported once it’s processed
          return file;
        }

        return listedAssets.some((a) => foldFileName(a.name) === name && a.sha === sha)
          ? undefined
          : file;
      }),
    )
  ).filter((file) => !!file);

/**
 * Check for duplicate files and ask the user if they want to replace them. A file identical to the
 * existing one doesn’t count. An earlier request still waiting for an answer is cancelled.
 * @param {object} args Arguments.
 * @param {File[]} args.files File list.
 * @param {Asset[]} args.listedAssets Listed assets.
 * @returns {Promise<boolean | undefined>} `true` if the user chooses to replace the existing file,
 * `false` if not, or `undefined` if the dialog is closed without making a choice. When there are no
 * duplicate files, it returns `false` without asking.
 */
export const checkDuplicates = async ({ files, listedAssets }) => {
  const previousCheck = lastCheck;
  const reading = getConflictingFiles(files, listedAssets);

  // A failed check mustn’t hold up the later ones
  lastCheck = reading.catch(() => undefined);

  const [, dupFiles] = await Promise.all([previousCheck, reading]);
  const count = dupFiles.length;

  if (!count) {
    return false;
  }

  return requestAnswer(duplicatesRequest, { count, name: dupFiles[0].name }, undefined);
};
