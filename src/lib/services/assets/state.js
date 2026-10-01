import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { Asset, UploadingAssets } from '$lib/types/private';
 */

/**
 * List of all assets.
 * @type {{ current: Asset[] }}
 */
export const allAssets = createRawState([]);

/**
 * List of the assets that exist on the configured branch, which is {@link allAssets} minus the ones
 * committed to an Editorial Workflow branch. The Asset Library and the asset search use this,
 * because most asset actions — renaming, moving, deleting — can’t operate on a file that only lives
 * on a pull request branch. Entry previews still resolve against {@link allAssets}, so an image
 * attached to an unpublished entry is displayed where it’s used.
 */
export const publishedAssets = createDerivedState(() =>
  // Keep the same array reference when there’s nothing to filter out, to avoid needless downstream
  // recomputation
  allAssets.current.some(({ workflow }) => workflow)
    ? allAssets.current.filter(({ workflow }) => !workflow)
    : allAssets.current,
);

/**
 * Selected assets.
 * @type {{ current: Asset[] }}
 */
export const selectedAssets = createRawState([]);

/**
 * Set of selected asset paths, for O(1) membership checks in list items.
 */
export const selectedAssetPathSet = createDerivedState(
  () => new Set(selectedAssets.current.map((asset) => asset.path)),
);

/**
 * Asset currently focused in the UI.
 * @type {{ current: Asset | undefined }}
 */
export const focusedAsset = createRawState();

/**
 * Assets the toolbar actions operate on: the selected assets, or else the focused asset, if any.
 * @type {{ readonly current: Asset[] }}
 */
export const selectedOrFocusedAssets = createDerivedState(() => {
  if (selectedAssets.current.length) {
    return [...selectedAssets.current];
  }

  return focusedAsset.current ? [focusedAsset.current] : [];
});

/**
 * Asset to be displayed in `<AssetDetailsOverlay>`.
 * @type {{ current: Asset | undefined }}
 */
export const overlaidAsset = createRawState();

/**
 * Assets currently being uploaded.
 * @type {{ current: UploadingAssets }}
 */
export const uploadingAssets = createRawState({ folder: undefined, files: [] });

/**
 * Asset currently being edited.
 * @type {{ current: Asset | undefined }}
 */
export const editingAsset = createRawState();

/**
 * Asset currently being renamed.
 * @type {{ current: Asset | undefined }}
 */
export const renamingAsset = createRawState();
