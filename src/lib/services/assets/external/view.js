import { _ } from '@sveltia/i18n';
import { untrack } from 'svelte';

import {
  externalAssets,
  externalAssetSearchTerms,
  focusedExternalAsset,
  selectedExternalAssets,
} from '$lib/services/assets/external';
import { currentView } from '$lib/services/assets/view';
import { sortItemsByKey } from '$lib/services/common/view';
import { normalize } from '$lib/services/search/util';
import { createDerivedState, createRootEffect } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * ExternalAsset,
 * FilteringConditions,
 * SortingConditions,
 * SortKey,
 * } from '$lib/types/private';
 */

/**
 * Keys the assets on a cloud storage service can be sorted by, and the value types that determine
 * the wording of the sort order labels. Unlike repository assets, these don’t have commit info, but
 * the services report when a file was last modified and its size.
 * @type {Record<string, 'date' | 'number' | undefined>}
 */
export const EXTERNAL_ASSET_SORT_KEY_TYPES = {
  name: undefined,
  last_modified: 'date',
  size: 'number',
};

/**
 * Keys the assets on a cloud storage service can be sorted by.
 */
export const EXTERNAL_ASSET_SORT_KEYS = Object.keys(EXTERNAL_ASSET_SORT_KEY_TYPES);

/**
 * List of available sort keys with localized labels. `_()` reads the current app locale, so the
 * list is recomputed when the locale changes.
 * @type {{ readonly current: SortKey[] }}
 */
export const externalAssetSortKeys = createDerivedState(() =>
  Object.entries(EXTERNAL_ASSET_SORT_KEY_TYPES).map(([key, type]) => ({
    key,
    label: _(`sort_keys.${key}`),
    type,
  })),
);

/**
 * Get an asset’s property value for sorting.
 * @param {ExternalAsset} asset Asset.
 * @param {string} key Sort key.
 * @returns {string | number} Value.
 */
export const getSortValue = (asset, key) => {
  if (key === 'last_modified') {
    return asset.lastModified?.getTime() ?? 0;
  }

  if (key === 'size') {
    return asset.size ?? 0;
  }

  // Exclude the file extension when sorting by name to sort numbered files properly, e.g.
  // `hero.png`, `hero-1.png`, `hero-2.png` instead of `hero-1.png`, `hero-2.png`, `hero.png`
  return asset.fileName.split('.')[0];
};

/**
 * Sort the given assets.
 * @param {ExternalAsset[]} assets Asset list.
 * @param {SortingConditions} [conditions] Sorting conditions.
 * @returns {ExternalAsset[]} Sorted asset list.
 */
export const sortExternalAssets = (assets, { key, order } = {}) => {
  if (!key || !order || !EXTERNAL_ASSET_SORT_KEYS.includes(key)) {
    return assets;
  }

  return sortItemsByKey([...assets], (asset) => getSortValue(asset, key), key === 'name', order);
};

/**
 * Filter the given assets. Only the `fileType` filter shown in the Asset Library is supported.
 * @param {ExternalAsset[]} assets Asset list.
 * @param {FilteringConditions} [conditions] Filtering conditions.
 * @returns {ExternalAsset[]} Filtered asset list.
 */
export const filterExternalAssets = (assets, { field, pattern } = { field: '', pattern: '' }) => {
  if (field !== 'fileType') {
    return assets;
  }

  return assets.filter(({ kind }) => kind === pattern);
};

/**
 * Narrow down the given assets by the search terms. The file name and description, which is the
 * path of the file on the service, are matched.
 * @param {ExternalAsset[]} assets Asset list.
 * @param {string} terms Search terms.
 * @returns {ExternalAsset[]} Matching asset list.
 */
export const searchExternalAssets = (assets, terms) => {
  const normalizedTerms = normalize(terms);

  if (!normalizedTerms) {
    return assets;
  }

  return assets.filter(
    ({ fileName, description }) =>
      normalize(fileName).includes(normalizedTerms) ||
      normalize(description).includes(normalizedTerms),
  );
};

/**
 * Sorted, filtered and searched assets on the selected cloud storage service. The Asset Library’s
 * {@link currentView} is shared with repository folders, so the view type, sort order and file
 * type filter are remembered per service just like per folder.
 * @type {{ readonly current: ExternalAsset[] }}
 */
export const listedExternalAssets = createDerivedState(() => {
  const { sort, filter } = currentView.current;
  let assets = externalAssets.current ?? [];

  assets = sortExternalAssets(assets, sort);
  assets = filterExternalAssets(assets, filter);
  assets = searchExternalAssets(assets, externalAssetSearchTerms.current);

  return assets;
});

/**
 * Drop the selected and focused assets that are no longer listed, so that the toolbar actions
 * never operate on an asset the user can’t see, e.g. one hidden by the search terms or the file
 * type filter. The selection survives a change of the sort order, as the assets stay listed.
 */
export const pruneHiddenAssets = () => {
  const listedIds = new Set(listedExternalAssets.current.map(({ id }) => id));

  untrack(() => {
    const selected = selectedExternalAssets.current;
    const visible = selected.filter(({ id }) => listedIds.has(id));

    if (visible.length !== selected.length) {
      selectedExternalAssets.current = visible;
    }

    if (focusedExternalAsset.current && !listedIds.has(focusedExternalAsset.current.id)) {
      focusedExternalAsset.current = undefined;
    }
  });
};

createRootEffect(pruneHiddenAssets);
