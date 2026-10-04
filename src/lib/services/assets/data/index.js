import { getAssetByInternalPath } from '$lib/services/assets';
import { focusedAsset, overlaidAsset } from '$lib/services/assets/state';
import { UPDATE_TOAST_DEFAULT_STATE } from '$lib/services/contents/collection/data';
import { createDeepState } from '$lib/services/utils/state.svelte';

/**
 * @import { Asset, UpdateToastState } from '$lib/types/private';
 */

/**
 * State of the asset updates toast notification.
 * @type {{ current: UpdateToastState }}
 */
export const assetUpdatesToast = createDeepState({ ...UPDATE_TOAST_DEFAULT_STATE });

/**
 * Replace the focused and overlaid assets with the ones now in the asset list, after the assets
 * have been saved, moved or renamed.
 * @param {(asset: Asset) => string | undefined} getPath Function to get the path the given asset is
 * now found at, or `undefined` to leave it as is.
 */
export const refreshFocusedAssets = (getPath) => {
  [focusedAsset, overlaidAsset].forEach((state) => {
    const path = state.current ? getPath(state.current) : undefined;

    if (path !== undefined) {
      state.current = getAssetByInternalPath(path);
    }
  });
};
