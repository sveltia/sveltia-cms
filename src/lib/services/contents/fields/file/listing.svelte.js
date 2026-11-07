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
 * What a {@link FolderAssetListing} is made from.
 * @typedef {object} FolderAssetListingOptions
 * @property {EntryDraft | null | undefined} draft Entry draft.
 * @property {AssetFolderInfo | undefined} folder Folder.
 * @property {InternalLocaleCode | undefined} locale Locale being edited, which an entry-relative
 * folder depends on.
 * @property {MediaLibraryAssetKind | undefined} kind Asset kind.
 * @property {string | undefined} accept Accepted file types.
 * @property {boolean | undefined} slugificationEnabled Whether file names are slugified, which the
 * provisional names of unsaved files depend on.
 * @property {Asset[]} [droppedAssets] Assets created from files dropped in a dialog. They are
 * listed whatever their type, because a transformation may still change it, and only checked once
 * inserted.
 */

/**
 * Stands in for the dropped assets of a listing without any, so that it stays the same value.
 * @type {Asset[]}
 */
const NO_ASSETS = [];

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
 * @param {() => FolderAssetListingOptions} getOptions Function returning the options, so the
 * listing follows their changes. A change of the accepted types, say, doesn’t read the draft’s
 * files again.
 * @returns {FolderAssetListing} Listing.
 */
export const createFolderAssetListing = (getOptions) => {
  const options = $derived(getOptions());
  // Kept apart as the effect below reads them. The other options only feed derived values, so a
  // change of one stops there unless it moves the folder path
  const draft = $derived(options.draft);
  const droppedAssets = $derived(options.droppedAssets ?? NO_ASSETS);
  /** @type {Asset[]} */
  let unsavedAssets = $state([]);

  const targetFolderPath = $derived(
    getTargetFolderPath({
      entry: draft?.originalEntry,
      folder: options.folder,
      locale: options.locale,
    }),
  );

  const listedAssets = $derived(
    listAssets({
      kind: options.kind,
      accept: options.accept,
      folder: options.folder,
      folderPath: targetFolderPath,
      unsavedAssets,
      uncheckedFiles: droppedAssets.map(({ file }) => /** @type {File} */ (file)),
      slugificationEnabled: options.slugificationEnabled,
    }),
  );

  watchAsync(
    async () => {
      // Copied before the first `await`, so that a dropped asset added later is tracked
      const dropped = [...droppedAssets];

      return [
        // The draft’s files are read synchronously, so their changes are tracked as well
        ...(draft ? await getUnsavedAssets({ draft, targetFolderPath }) : []),
        ...dropped,
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
