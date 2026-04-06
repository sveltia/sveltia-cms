import { _ } from '@sveltia/i18n';

import { buildGroupMap } from '$lib/services/common/view';

/**
 * @import { Asset, GroupingConditions } from '$lib/types/private';
 */

/**
 * Group the given assets.
 * @param {Asset[]} assets Asset list.
 * @param {GroupingConditions} [conditions] Grouping conditions.
 * @returns {Record<string, Asset[]>} Grouped assets, where key is a group label and value is an
 * asset list.
 */
export const groupAssets = (assets, { field, pattern } = { field: '', pattern: undefined }) => {
  if (!field) {
    return assets.length ? { '*': assets } : {};
  }

  const otherKey = _('other');

  return Object.fromEntries(
    buildGroupMap(
      assets,
      pattern,
      (asset) => /** @type {Record<string, any>} */ (asset)[field],
      otherKey,
    ),
  );
};
