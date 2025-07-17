import { compare } from '@sveltia/utils/string';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { getRegex } from '$lib/services/utils/misc';

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

  const regex = getRegex(pattern);
  /** @type {Record<string, Asset[]>} */
  const groups = {};
  const otherKey = get(_)('other');

  assets.forEach((asset) => {
    const value = /** @type {Record<string, any>} */ (asset)[field];
    /** @type {string} */
    let key;

    if (regex) {
      [key = otherKey] = String(value ?? '').match(regex) ?? [];
    } else {
      key = value;
    }

    if (!(key in groups)) {
      groups[key] = [];
    }

    groups[key].push(asset);
  });

  // Sort groups by key
  return Object.fromEntries(Object.entries(groups).sort(([aKey], [bKey]) => compare(aKey, bKey)));
};
