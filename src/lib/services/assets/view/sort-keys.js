import { _, locale as appLocale } from '@sveltia/i18n';
import { derived, toStore } from 'svelte/store';

import { allAssets } from '$lib/services/assets';

/**
 * @import { Readable } from 'svelte/store';
 */

/**
 * List of available sort keys for the selected asset collection.
 * @type {Readable<{ key: string, label: string }[]>}
 */
export const sortKeys = derived(
  // Include `appLocale.current` as a dependency because it returns a localized label
  [allAssets, toStore(() => appLocale.current)],
  ([_allAssets], set) => {
    const _sortFields = ['name'];

    if (_allAssets.every((asset) => !!asset.commitAuthor)) {
      _sortFields.push('commit_author');
    }

    if (_allAssets.every((asset) => !!asset.commitDate)) {
      _sortFields.push('commit_date');
    }

    set(_sortFields.map((key) => ({ key, label: _(`sort_keys.${key}`) })));
  },
);
