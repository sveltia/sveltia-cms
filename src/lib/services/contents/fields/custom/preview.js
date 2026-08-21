import { fromJS } from 'immutable';

import { getFieldConfigMap, getPreviewData } from '$lib/services/contents/fields/custom/helpers';

/**
 * @import { MapOf } from 'immutable';
 * @import { EntryDraft } from '$lib/types/private';
 * @import { CustomField, CustomFieldPreviewProps } from '$lib/types/public';
 */

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
