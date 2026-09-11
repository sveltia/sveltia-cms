import { _ } from '@sveltia/i18n';

import { allAssets } from '$lib/services/assets';
import { createDerivedState } from '$lib/services/utils/state.svelte';

/**
 * List of available sort keys for the selected asset collection. The labels are localized, and
 * `_()` reads the current app locale, so the list is recomputed when the locale changes.
 * @type {{ readonly current: { key: string, label: string }[] }}
 */
export const sortKeys = createDerivedState(() => {
  const { current: _allAssets } = allAssets;
  const _sortFields = ['name'];

  if (_allAssets.every((asset) => !!asset.commitAuthor)) {
    _sortFields.push('commit_author');
  }

  if (_allAssets.every((asset) => !!asset.commitDate)) {
    _sortFields.push('commit_date');
  }

  return _sortFields.map((key) => ({ key, label: _(`sort_keys.${key}`) }));
});
