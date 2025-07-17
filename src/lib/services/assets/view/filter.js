import { getAssetKind } from '$lib/services/assets';
import { getRegex } from '$lib/services/utils/misc';

/**
 * @import { Asset, FilteringConditions } from '$lib/types/private';
 */

/**
 * Filter the given assets.
 * @param {Asset[]} assets Asset list.
 * @param {FilteringConditions} [conditions] Filtering conditions.
 * @returns {Asset[]} Filtered asset list.
 */
export const filterAssets = (assets, { field, pattern } = { field: '', pattern: '' }) => {
  if (!field) {
    return assets;
  }

  if (field === 'fileType') {
    return assets.filter(({ path }) => getAssetKind(path) === pattern);
  }

  const regex = getRegex(pattern);

  return assets.filter((asset) => {
    const value = /** @type {Record<string, any>} */ (asset)[field];

    if (regex) {
      return regex.test(String(value ?? ''));
    }

    return value === pattern;
  });
};
