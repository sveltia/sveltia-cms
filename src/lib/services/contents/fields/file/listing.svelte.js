import { getTargetFolderPath, listAssets } from '$lib/services/contents/fields/file/helpers';
import { getUnsavedAssets } from '$lib/services/contents/fields/file/process';
import { watchAsync } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * Asset,
 * AssetFolderInfo,
 * EntryDraft,
 * InternalLocaleCode,
 * MediaLibraryAssetKind,
 * } from '$lib/types/private';
 */

/**
 * Reactive listing of the assets in a folder a File/Image field stores its files in, created with
 * {@link createFolderAssetListing}.
 * @typedef {object} FolderAssetListing
 * @property {string | undefined} targetFolderPath Path of the folder, resolved for the entry.
 * @property {Asset[]} listedAssets Assets in the folder, saved or not, that a file dropped there
 * could replace: those of the given kind and accepted types, unsaved ones first.
 * @property {Asset[]} unsavedAssets The draft’s files that have not been saved yet, plus the
 * dropped ones.
 * @property {() => void} reset Forget the unsaved assets until they are read again.
 */

/**
 * Create a reactive listing of the assets in the folder a File/Image field stores its files in,
 * including the files held in the entry draft that have not been saved yet. A dropped file is
 * checked against it for a duplicate name. The draft’s files are read asynchronously whenever the
 * draft or the folder changes, and a read started for an earlier state is never taken over a later
 * one. Call it during component initialization, as it sets up an effect.
 * @param {object} args Arguments. Each one is a function, so the listing follows its changes.
 * @param {() => EntryDraft | null | undefined} args.getDraft Function returning the entry draft.
 * @param {() => AssetFolderInfo | undefined} args.getFolder Function returning the folder.
 * @param {() => InternalLocaleCode | undefined} args.getLocale Function returning the locale being
 * edited, which an entry-relative folder depends on.
 * @param {() => MediaLibraryAssetKind | undefined} args.getKind Function returning the asset kind.
 * @param {() => string | undefined} args.getAccept Function returning the accepted file types.
 * @param {() => boolean | undefined} args.getSlugificationEnabled Function returning whether file
 * names are slugified, which the provisional names of unsaved files depend on.
 * @param {() => Asset[]} [args.getDroppedAssets] Function returning the assets created from files
 * dropped in a dialog. They are listed whatever their type, because a transformation may still
 * change it, and only checked once inserted.
 * @returns {FolderAssetListing} Listing.
 */
export const createFolderAssetListing = ({
  getDraft,
  getFolder,
  getLocale,
  getKind,
  getAccept,
  getSlugificationEnabled,
  getDroppedAssets = () => [],
}) => {
  /** @type {Asset[]} */
  let unsavedAssets = $state([]);

  const targetFolderPath = $derived(
    getTargetFolderPath({
      entry: getDraft()?.originalEntry,
      folder: getFolder(),
      locale: getLocale(),
    }),
  );

  const listedAssets = $derived(
    listAssets({
      kind: getKind(),
      accept: getAccept(),
      folder: getFolder(),
      folderPath: targetFolderPath,
      unsavedAssets,
      uncheckedFiles: getDroppedAssets().map(({ file }) => /** @type {File} */ (file)),
      slugificationEnabled: getSlugificationEnabled(),
    }),
  );

  watchAsync(
    async () => {
      const draft = getDraft();
      // Copied before the first `await`, so that a dropped asset added later is tracked
      const droppedAssets = [...getDroppedAssets()];

      return [
        // The draft’s files are read synchronously, so their changes are tracked as well
        ...(draft ? await getUnsavedAssets({ draft, targetFolderPath }) : []),
        ...droppedAssets,
      ];
    },
    (assets) => {
      unsavedAssets = assets;
    },
  );

  return {
    /**
     * Get the folder path.
     * @returns {string | undefined} Path.
     */
    get targetFolderPath() {
      return targetFolderPath;
    },
    /**
     * Get the listed assets.
     * @returns {Asset[]} Assets.
     */
    get listedAssets() {
      return listedAssets;
    },
    /**
     * Get the unsaved assets.
     * @returns {Asset[]} Assets.
     */
    get unsavedAssets() {
      return unsavedAssets;
    },
    /**
     * Forget the unsaved assets until they are read again.
     */
    reset: () => {
      unsavedAssets = [];
    },
  };
};
