import { _ } from '@sveltia/i18n';

import { isFieldMultiple } from '$lib/services/contents/entry/fields';
import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/helper';
import { getFormattedDateTime } from '$lib/services/contents/fields/date-time/validate';

/**
 * @import { EntryValidityState } from '$lib/types/private';
 * @import {
 * DateTimeField,
 * DateTimeInputType,
 * Field,
 * MinMaxValueField,
 * StringField,
 * TextField,
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
  // @ts-ignore Some field types don't have `pattern` property
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

  return messages;
};
