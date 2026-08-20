import { fromJS } from 'immutable';

import { buildPreviewData } from '$lib/services/api/helpers';

/**
 * @import { MapOf } from 'immutable';
 * @import { EntryDraft } from '$lib/types/private';
 * @import { CustomField } from '$lib/types/public';
 */

/**
 * Cache of Immutable Maps converted from field configurations. Field configurations are immutable
 * objects created once during config normalization, so they can be safely used as `WeakMap` keys,
 * and entries are garbage collected along with the configuration.
 * @type {WeakMap<CustomField, MapOf<CustomField>>}
 */
const fieldConfigMapCache = new WeakMap();

/**
 * Convert a field configuration to an Immutable Map for a React component, reusing the previous
 * result for the same configuration object. Returning a stable reference avoids deep-converting the
 * configuration on every render and lets `React.memo()` and `shouldComponentUpdate()` in custom
 * widgets skip unnecessary re-renders.
 * @param {CustomField} fieldConfig Field configuration.
 * @returns {MapOf<CustomField>} Immutable Map of the field configuration.
 */
export const getFieldConfigMap = (fieldConfig) => {
  const cached = fieldConfigMapCache.get(fieldConfig);

  if (cached) {
    return cached;
  }

  const map = /** @type {MapOf<CustomField>} */ (fromJS(fieldConfig));

  fieldConfigMapCache.set(fieldConfig, map);

  return map;
};

/**
 * Short-lived cache of {@link buildPreviewData} results, keyed by locale. Building the data walks
 * the whole entry and deep-converts it to Immutable Maps, so when several custom field controls
 * and previews render in response to one change, they should share a computation instead of
 * repeating it.
 *
 * The cache is only valid for the current microtask: the entry draft is mutated in place rather
 * than replaced, so the draft object cannot be used to detect changes, and holding the data any
 * longer would risk serving stale content.
 * @type {Map<string, ReturnType<typeof buildPreviewData>>}
 */
const previewDataCache = new Map();
/** Whether a microtask to flush {@link previewDataCache} has already been scheduled. */
let previewDataCacheFlushScheduled = false;

/**
 * Get the preview data for the given draft, reusing the result computed earlier in the same
 * microtask when available.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft entry state.
 * @param {string} args.locale Current locale.
 * @returns {ReturnType<typeof buildPreviewData>} Preview data.
 */
export const getPreviewData = ({ draft, locale }) => {
  const cached = previewDataCache.get(locale);

  if (cached) {
    return cached;
  }

  const data = buildPreviewData({ draft, locale: /** @type {any} */ (locale) });

  previewDataCache.set(locale, data);

  if (!previewDataCacheFlushScheduled) {
    previewDataCacheFlushScheduled = true;

    queueMicrotask(() => {
      previewDataCache.clear();
      previewDataCacheFlushScheduled = false;
    });
  }

  return data;
};
