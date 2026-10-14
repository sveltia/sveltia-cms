import { getImmutable } from '$lib/services/api/immutable';
import { isReactComponent } from '$lib/services/api/react';
import { customFieldTypeRegistry } from '$lib/services/api/registries';
import { getFieldConfigMap, getPreviewData } from '$lib/services/contents/fields/custom/helpers';

/**
 * @import { MapOf } from 'immutable';
 * @import { EntryDraft } from '$lib/types/private';
 * @import {
 * CustomField,
 * CustomFieldPreviewProps,
 * CustomFieldSummary,
 * Field,
 * FieldKeyPath,
 * } from '$lib/types/public';
 */

/**
 * Get the summary component of a custom field type, which draws a collapsed List field item when
 * the List field has a single subfield of the type.
 * @param {Field | undefined} fieldConfig Configuration of the single subfield.
 * @returns {CustomFieldSummary | undefined} React component, or `undefined` if the subfield isn’t
 * of a custom field type registered with a summary component.
 */
export const getCustomFieldSummary = (fieldConfig) => {
  const { widget } = fieldConfig ?? {};

  return widget ? customFieldTypeRegistry.get(widget)?.summary : undefined;
};

/**
 * Build props for a custom field preview React component.
 * @param {object} args Arguments.
 * @param {string} args.locale Current locale.
 * @param {FieldKeyPath} args.keyPath Key path of the field, e.g. `authors.0.name`.
 * @param {CustomField} args.fieldConfig Field configuration.
 * @param {any} args.currentValue Current field value.
 * @param {EntryDraft | null | undefined} args.draft Draft entry state.
 * @param {any} args.preview Preview component.
 * @returns {CustomFieldPreviewProps | undefined} Props object or `undefined` if prerequisites are
 * not met.
 */
export const buildPreviewProps = ({
  locale,
  keyPath,
  fieldConfig,
  currentValue,
  draft,
  preview,
}) => {
  if (!isReactComponent(preview) || !draft) {
    return undefined;
  }

  const { entryMap, fieldsMetaData, getAsset } = getPreviewData({ draft, locale });
  // `getMetaData()` keys the metadata by the full key path, with any trailing list index removed
  const metadataKey = keyPath.replace(/\.\d+$/, '');

  /** @type {CustomFieldPreviewProps} */
  return {
    value: currentValue,
    field: getFieldConfigMap(fieldConfig),
    metadata: /** @type {MapOf<any>} */ (
      fieldsMetaData.get(metadataKey) ?? getImmutable().fromJS({})
    ),
    getAsset,
    entry: entryMap,
    fieldsMetaData,
  };
};
