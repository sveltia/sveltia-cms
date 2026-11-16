import { createDerivedState, createRawState } from '$lib/services/utils/state.svelte';

/**
 * @import { Asset, AssetMoveRequest, UploadingAssets } from '$lib/types/private';
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

/**
 * Assets to be moved to another folder with the Move dialog, which is open while this is set.
 * @type {{ current: AssetMoveRequest | undefined }}
 */
export const assetMoveRequest = createRawState();

/**
 * Files being dragged from the asset list, repository assets or files on a cloud storage service,
 * which a folder in the sidebar or a subfolder in the list can be dropped on. `undefined` while
 * nothing is dragged. The drag data can’t be read until the drop, so this is what tells a folder
 * whether it can take the drop while it’s dragged over.
 * @type {{ current: AssetMoveRequest | undefined }}
 */
export const draggedFiles = createRawState();
