import { fromJS } from 'immutable';

import { buildPreviewData } from '$lib/services/api/helpers';
import { getFieldConfigMap } from '$lib/services/contents/fields/custom/helpers';

/**
 * @import { MapOf } from 'immutable';
 * @import { EntryDraft } from '$lib/types/private';
 * @import { CustomField, CustomFieldPreviewProps } from '$lib/types/public';
 */

/**
 * Short-lived cache of {@link buildPreviewData} results, keyed by locale. Building the data walks
 * the whole entry and deep-converts it to Immutable Maps, so when several custom field previews
 * render in response to one change, they should share a computation instead of repeating it.
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
const getPreviewData = ({ draft, locale }) => {
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

/**
 * Build props for a custom field preview React component.
 * @param {object} args Arguments.
 * @param {string} args.locale Current locale.
 * @param {CustomField} args.fieldConfig Field configuration.
 * @param {any} args.currentValue Current field value.
 * @param {EntryDraft | null | undefined} args.draft Draft entry state.
 * @param {any} args.preview Preview component.
 * @returns {CustomFieldPreviewProps | undefined} Props object or `undefined` if prerequisites are
 * not met.
 */
export const buildPreviewProps = ({ locale, fieldConfig, currentValue, draft, preview }) => {
  if (typeof preview !== 'function' || !draft) {
    return undefined;
  }

  const { entryMap, fieldsMetaData, getAsset } = getPreviewData({ draft, locale });

  /** @type {CustomFieldPreviewProps} */
  return {
    value: currentValue,
    field: getFieldConfigMap(fieldConfig),
    metadata: /** @type {MapOf<any>} */ (fieldsMetaData.get(fieldConfig.name) ?? fromJS({})),
    getAsset,
    entry: entryMap,
    fieldsMetaData,
  };
};
