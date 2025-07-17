import { derived, get } from 'svelte/store';
import { _, locale as appLocale } from 'svelte-i18n';
import { allAssets } from '$lib/services/assets';

/**
 * @import { Readable } from 'svelte/store';
 */

/**
 * List of available sort keys for the selected asset collection.
 * @type {Readable<{ key: string, label: string }[]>}
 */
export const sortKeys = derived(
  // Include `appLocale` as a dependency because it returns a localized label
  [allAssets, appLocale],
  ([_allAssets], set) => {
    const _sortFields = ['name'];

    if (_allAssets.every((asset) => !!asset.commitAuthor)) {
      _sortFields.push('commit_author');
    }

    if (_allAssets.every((asset) => !!asset.commitDate)) {
      _sortFields.push('commit_date');
    }

    set(_sortFields.map((key) => ({ key, label: get(_)(`sort_keys.${key}`) })));
  },
);
