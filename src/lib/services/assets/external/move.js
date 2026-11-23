import { _ } from '@sveltia/i18n';

import {
  getMoveBlockedMessage,
  planReferenceRewrite,
  saveReferenceChanges,
} from '$lib/services/assets/data/move';
import { getFetchOptions } from '$lib/services/assets/external';
import { assetsLocked } from '$lib/services/assets/folders';
import { runWithUndo } from '$lib/services/utils/undo';

/**
 * @import { Entry, ExternalAsset, MediaLibraryService } from '$lib/types/private';
 * @import { ReferenceRewritePlan } from '$lib/services/assets/data/move';
 */

/**
 * Get the message explaining why files on a cloud storage service can’t be renamed or moved: the
 * references to them in the entries can’t be updated, as one of the entries is read-only, or the
 * media library is locked, as for an Open Authoring contributor, so no commit can be made.
 * @param {Entry[]} entries Entries using the files.
 * @param {number} count Number of files.
 * @returns {string | undefined} Message, or `undefined` if the references can be updated.
 */
export const getExternalChangeBlockedMessage = (entries, count) =>
  getMoveBlockedMessage(entries) ??
  (assetsLocked.current && entries.length
    ? _('cannot_change_used_external_files', { values: { count } })
    : undefined);

/**
 * Find the entries using some files on a cloud storage service before the files are moved or
 * renamed, and refuse if the references in them can’t be updated: an entry is read-only, or the
 * media library is locked, as for an Open Authoring contributor, so no commit can be made. A file
 * on a service is hotlinked, so its download URL is what the entries store.
 * @param {ExternalAsset[]} assets Files.
 * @returns {Promise<ReferenceRewritePlan>} Plan to pass to `saveReferenceChanges()`.
 * @throws {Error} When the references can’t be updated, with a message saying why.
 */
export const planExternalReferenceRewrite = async (assets) => {
  // A read-only entry is refused here
  const plan = await planReferenceRewrite(assets.map(({ downloadURL }) => ({ url: downloadURL })));

  const message = getExternalChangeBlockedMessage(
    [...new Set(plan.usedEntries.flat())],
    assets.length,
  );

  if (message) {
    throw new Error(message);
  }

  return plan;
};

/**
 * Move a file to another path on a cloud storage service.
 * @param {MediaLibraryService} service Service, which can move files.
 * @param {ExternalAsset} asset File.
 * @param {string} path New path relative to the configured prefix.
 * @returns {Promise<ExternalAsset>} Moved file.
 */
const moveFile = (service, asset, path) =>
  /** @type {NonNullable<MediaLibraryService['move']>} */ (service.move)(
    asset,
    path,
    getFetchOptions(service),
  );

/**
 * Move files to other paths on a cloud storage service, one at a time as the services do, then
 * save the entries using them, pointing at the new URLs. If a move or the save fails, the files
 * moved so far are moved back, so the entries still find them; a file that can’t be moved back is
 * left where it is.
 * @param {object} args Arguments.
 * @param {MediaLibraryService} args.service Service, which can move files.
 * @param {{ asset: ExternalAsset, path: string }[]} args.moves Files and their new paths, relative
 * to the configured prefix.
 * @param {ReferenceRewritePlan} args.plan Entries using the files, in the same order, from
 * {@link planExternalReferenceRewrite}.
 * @returns {Promise<ExternalAsset[]>} Moved files, in the same order.
 * @throws {Error} When a move or the save fails.
 */
export const moveFilesWithReferences = ({ service, moves, plan }) =>
  runWithUndo(
    moves.map(({ asset, path }) => ({
      // eslint-disable-next-line jsdoc/require-jsdoc
      run: () => moveFile(service, asset, path),
      // eslint-disable-next-line jsdoc/require-jsdoc
      undo: (movedAsset) => moveFile(service, movedAsset, asset.description),
    })),
    (movedAssets) =>
      saveReferenceChanges({
        plan,
        newURLs: movedAssets.map(({ downloadURL }) => downloadURL),
        commitType: 'uploadMedia',
      }),
  );
