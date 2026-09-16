import { buildGroupMap } from '$lib/services/common/view';

/**
 * @import { Asset, GroupingConditions } from '$lib/types/private';
 */

/**
 * Group the given assets.
 * @param {Asset[]} assets Asset list.
 * @param {GroupingConditions | null} [conditions] Grouping conditions.
 * @returns {Record<string, Asset[]>} Grouped assets, where key is a group name, displayed with
 * `getGroupLabel()`, and value is an asset list.
 */
export const groupAssets = (assets, conditions) => {
  const { field, pattern } = conditions ?? {};

  if (!field) {
    return assets.length ? { '*': assets } : {};
  }

  return Object.fromEntries(
    buildGroupMap(assets, pattern, (asset) => /** @type {Record<string, any>} */ (asset)[field]),
  );
};
