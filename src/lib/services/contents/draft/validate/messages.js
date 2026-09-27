import { _ } from '@sveltia/i18n';

import { getField, isFieldMultiple } from '$lib/services/contents/entry/fields';
import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/config';
import { getFormattedDateTime } from '$lib/services/contents/fields/date-time/validate';
import { COMPONENT_NAME_PREFIX_REGEX } from '$lib/services/contents/fields/rich-text';

/**
 * @import { EntryDraft, EntryValidityState, InternalLocaleCode } from '$lib/types/private';
 * @import {
 * DateTimeField,
 * DateTimeInputType,
 * Field,
 * FieldKeyPath,
 * MinMaxValueField,
 * StringField,
 * TextField,
 * VisibleField,
 * } from '$lib/types/public';
 */

/**
 * Get the error message for a range validity error (underflow or overflow).
 * @param {object} args Arguments.
 * @param {string} args.direction `'underflow'` or `'overflow'`.
 * @param {string} args.limitKey `'min'` or `'max'`.
 * @param {string | number | undefined} args.limitValue The limit value from the field config.
 * @param {string} args.fieldType Field widget type.
 * @param {string | undefined} args.type Native input type derived from the field config.
 * @param {boolean} args.canAddMultiValue Whether the field supports adding multiple values.
 * @returns {string} Translated error message.
 */
const getRangeErrorMessage = ({
  direction,
  limitKey,
  limitValue,
  fieldType,
  type,
  canAddMultiValue,
}) => {
  if (fieldType === 'datetime' && typeof limitValue === 'string') {
    return _(`validation.range_${direction}.${type}`, {
      values: {
        [limitKey]: getFormattedDateTime(/** @type {DateTimeInputType} */ (type), limitValue),
      },
    });
  }

  if (fieldType === 'number') {
    return _(`validation.range_${direction}.number`, { values: { [limitKey]: limitValue } });
  }

  if (canAddMultiValue) {
    return _(`validation.range_${direction}.add`, {
      values: { [limitKey]: limitValue },
    });
  }

  return _(`validation.range_${direction}.select`, { values: { [limitKey]: limitValue } });
};

/**
 * Get the human-readable validation error messages for a field given its current validity state.
 * @param {object} args Arguments.
 * @param {EntryValidityState} args.validity Field validity state.
 * @param {Field} args.fieldConfig Full field configuration.
 * @returns {string[]} List of translated error message strings, one per violated constraint.
 */
export const getFieldValidationMessages = ({ validity, fieldConfig }) => {
  /** @type {string[]} */
  const messages = [];
  const { widget: fieldType = 'string' } = fieldConfig;
  // @ts-ignore Some field types don’t have `pattern` property
  const { pattern = /** @type {string[]} */ ([]) } = fieldConfig;
  const isDatetime = fieldType === 'datetime';

  const parsedDateTimeConf = isDatetime
    ? parseDateTimeConfig(/** @type {DateTimeField} */ (fieldConfig))
    : /** @type {ReturnType<typeof parseDateTimeConfig>} */ ({});

  // prettier-ignore
  const type =
    fieldType === 'string'
      ? /** @type {StringField} */ (fieldConfig).type ?? 'text'
      : isDatetime
        ? parsedDateTimeConf.type
        : fieldType === 'number'
          ? /** @type {'number'} */ ('number')
          : undefined;

  const { min, max } = isDatetime
    ? parsedDateTimeConf
    : /** @type {MinMaxValueField} */ (fieldConfig);

  const canAddMultiValue =
    fieldType === 'list' || fieldType === 'keyvalue' || isFieldMultiple(fieldConfig);

  if (validity.valueMissing) {
    messages.push(_('validation.value_missing'));
  }

  if (validity.tooShort) {
    const { minlength } = /** @type {StringField | TextField} */ (fieldConfig);

    messages.push(_('validation.too_short', { values: { min: minlength } }));
  }

  if (validity.tooLong) {
    const { maxlength } = /** @type {StringField | TextField} */ (fieldConfig);

    messages.push(_('validation.too_long', { values: { max: maxlength } }));
  }

  if (validity.rangeUnderflow) {
    messages.push(
      getRangeErrorMessage({
        direction: 'underflow',
        limitKey: 'min',
        limitValue: min,
        fieldType,
        type,
        canAddMultiValue,
      }),
    );
  }

  if (validity.rangeOverflow) {
    messages.push(
      getRangeErrorMessage({
        direction: 'overflow',
        limitKey: 'max',
        limitValue: max,
        fieldType,
        type,
        canAddMultiValue,
      }),
    );
  }

  if (validity.patternMismatch) {
    messages.push(pattern[1]);
  }

  if (validity.typeMismatch) {
    messages.push(_(`validation.type_mismatch.${type}`));
  }

  if (validity.customError) {
    messages.push(validity.customErrorMessage ?? _('validation.invalid_value'));
  }

  return messages;
};

/**
 * Get the human-readable validation error messages for the folder chosen with the entry path
 * editor, which is validated as `_path` rather than as a field, so it has no stored messages.
 * @param {EntryValidityState | undefined} validity Validity state of the path.
 * @returns {string[]} List of translated error message strings, one per violated constraint.
 * @see validatePath
 */
export const getPathValidationMessages = (validity) => {
  /** @type {string[]} */
  const messages = [];

  if (validity?.patternMismatch) {
    messages.push(_('edit_path_error.invalid'));
  }

  if (validity?.customError) {
    messages.push(_('edit_path_error.recursive'));
  }

  if (validity?.duplicateError) {
    messages.push(_('edit_path_error.duplicate'));
  }

  return messages;
};

/**
 * Get the fields that have validation error messages in the given locale, in the order the fields
 * were validated. That includes the fields of rich text editor components, stored in
 * `extraValues`, and a multi-value field whose list itself is invalid, whose key path, e.g.
 * `tags`, only holds messages while the values are stored under `tags.0`, `tags.1`, etc.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Entry draft.
 * @param {InternalLocaleCode} args.locale Locale code.
 * @returns {{ keyPath: FieldKeyPath, label: string, messages: string[] }[]} Invalid fields, with
 * the label of each field or its name if the label is not defined, or an empty string if the field
 * cannot be found.
 */
export const getInvalidFields = ({ draft, locale }) => {
  const { collectionName, fileName, isIndexFile, currentValues, extraValues } = draft;
  const currentValueMap = currentValues[locale] ?? {};
  const extraValueMap = extraValues[locale] ?? {};

  return (
    Object.entries(draft.validationMessages[locale] ?? {})
      .filter(([, messages]) => !!messages.length)
      .map(([keyPath, messages]) => {
        const [prefix] = keyPath.match(COMPONENT_NAME_PREFIX_REGEX) ?? [];
        const valueMap = prefix ? extraValueMap : currentValueMap;

        return { keyPath, messages, prefix, valueMap };
      })
      // The messages are kept until the next validation, so skip a field removed since then, e.g. a
      // list item or a rich text editor component. A list is kept as long as it has an item, which
      // is stored under `tags.0`, etc. while the list itself is validated as `tags`
      .filter(
        ({ keyPath, valueMap }) =>
          keyPath in valueMap || Object.keys(valueMap).some((key) => key.startsWith(`${keyPath}.`)),
      )
      .map(({ keyPath, messages, prefix, valueMap }) => {
        const field = getField({
          collectionName,
          fileName,
          isIndexFile,
          // A rich text editor component field is looked up in the component definition
          componentName: prefix ? extraValueMap[`${prefix}__sc_component_name`] : undefined,
          keyPath: keyPath.replace(COMPONENT_NAME_PREFIX_REGEX, ''), // Remove component name prefix
          valueMap,
        });

        return {
          keyPath,
          label: /** @type {VisibleField | undefined} */ (field)?.label || field?.name || '',
          messages,
        };
      })
  );
};
