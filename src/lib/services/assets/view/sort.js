import { compare } from '@sveltia/utils/string';

/**
 * @import { Asset, SortingConditions } from '$lib/types/private';
 */

/**
 * Get an asset’s property value.
 * @param {Asset} asset Asset.
 * @param {string} key Sorting key. A field name of the asset or a special key like `commit_author`,
 * `commit_date`, or `name`.
 * @returns {any} Value.
 */
const getValue = (asset, key) => {
  const { commitAuthor: { name, login, email } = {}, commitDate } = asset;

  if (key === 'commit_author') {
    return name || login || email;
  }

  if (key === 'commit_date') {
    return commitDate;
  }

  // Exclude the file extension when sorting by name to sort numbered files properly, e.g.
  // `hero.png`, `hero-1.png`, `hero-2.png` instead of `hero-1.png`, `hero-2.png`, `hero.png`
  if (key === 'name') {
    return asset.name.split('.')[0];
  }

  return /** @type {Record<string, any>} */ (asset)[key] ?? '';
};

/**
 * Sort the given assets.
 * @param {Asset[]} assets Asset list.
 * @param {SortingConditions} [conditions] Sorting conditions.
 * @returns {Asset[]} Sorted asset list.
 */
export const sortAssets = (assets, { key, order } = {}) => {
  if (!key || !order) {
    return assets;
  }

  const _assets = [...assets];

  const type =
    { commit_author: String, commit_date: Date }[key] ||
    /** @type {Record<string, any>} */ (_assets[0])?.[key]?.constructor ||
    String;

  _assets.sort((a, b) => {
    const aValue = getValue(a, key);
    const bValue = getValue(b, key);

    if (type === String) {
      return compare(aValue, bValue);
    }

    if (type === Date) {
      return Number(aValue) - Number(bValue);
    }

    return aValue - bValue;
  });

  if (order === 'descending') {
    _assets.reverse();
  }

  return _assets;
};
