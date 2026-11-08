import { untrack } from 'svelte';

import {
  defaultAssetDetails,
  getAssetDetails,
  getAssetUsedEntries,
} from '$lib/services/assets/details';

/**
 * @import { Asset, AssetDetails, Entry } from '$lib/types/private';
 */

/**
 * Keep the details of an asset up to date as the asset changes, for a component that stays mounted
 * while the focus moves from one asset to another. The details of the previous asset are dropped
 * right away, so they’re not shown or acted on while the new ones are being retrieved, and a slow
 * lookup for an asset focused earlier never overwrites the details of the one focused now. Call it
 * while a component is being initialized.
 * @param {() => Asset | undefined} getAsset Function returning the asset, if any.
 * @param {object} [options] Options.
 * @param {boolean} [options.withUsedEntries] Whether to look up the entries using the asset as
 * well, once the details have been retrieved. `usedEntries` is `undefined` until then.
 * @returns {{ current: AssetDetails }} Details, which are the defaults until retrieved, or if they
 * can’t be.
 */
export const createAssetDetailsState = (getAsset, { withUsedEntries = false } = {}) => {
  const state = $state({ current: { ...defaultAssetDetails } });

  $effect(() => {
    const asset = getAsset();
    let stale = false;

    untrack(() => {
      state.current = withUsedEntries
        ? { ...defaultAssetDetails, usedEntries: undefined }
        : { ...defaultAssetDetails };
    });

    if (asset) {
      (async () => {
        try {
          const details = await getAssetDetails(asset);

          if (stale) {
            return;
          }

          state.current = details;
        } catch (/** @type {any} */ ex) {
          // Only the basic info is shown, as the URLs are unknown, but the used entries don’t
          // depend on the details
          // eslint-disable-next-line no-console
          console.error(ex);
        }

        if (!withUsedEntries || stale) {
          return;
        }

        /** @type {Entry[]} */
        let usedEntries = [];

        try {
          usedEntries = await getAssetUsedEntries(asset);
        } catch (/** @type {any} */ ex) {
          // Stop showing the used entries as being loaded
          // eslint-disable-next-line no-console
          console.error(ex);
        }

        if (!stale) {
          state.current.usedEntries = usedEntries;
        }
      })();
    }

    return () => {
      stale = true;
    };
  });

  return state;
};
