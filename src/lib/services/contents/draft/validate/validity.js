/**
 * @import { EntryValidityState } from '$lib/types/private';
 */

/**
 * Default validity state for a field.
 * @type {EntryValidityState}
 */
export const DEFAULT_VALIDITY = {
  valueMissing: false,
  tooShort: false,
  tooLong: false,
  rangeUnderflow: false,
  rangeOverflow: false,
  patternMismatch: false,
  typeMismatch: false,
  customError: false,
  duplicateError: false,
  mapKeyDuplicate: false,
  mapKeyNumeric: false,
};

/**
 * Finalize a validity state by adding the `valid` property, which is `true` when none of the
 * constraint flags is set. Mimics the native `ValidityState.valid` property.
 *
 * This is a plain property rather than a getter or a Proxy trap: the validity state is stored in
 * the reactive entry draft, whose `$state` proxy reads own properties only, so a computed property
 * would be invisible there.
 * @param {EntryValidityState} validity Validity state without the `valid` property.
 * @returns {EntryValidityState} Validity state with the `valid` property.
 */
export const finalizeValidity = (validity) => {
  const finalized = { ...validity };

  finalized.valid = !Object.values(validity).some(Boolean);

  return finalized;
};

/**
 * Flag the given validity state when a field holding a number of items, like a List or KeyValue
 * field, has too few or too many of them, or none at all while it’s required.
 * @param {EntryValidityState} validity Validity state to update in place.
 * @param {object} args Arguments.
 * @param {number} args.count Number of items.
 * @param {boolean} args.required Whether the field is required.
 * @param {any} args.min The field’s `min` option. Ignored unless it’s a number.
 * @param {any} args.max The field’s `max` option. Ignored unless it’s a number.
 */
export const validateItemCount = (validity, { count, required, min, max }) => {
  if (required && !count) {
    validity.valueMissing = true;
  } else if (typeof min === 'number' && count < min) {
    validity.rangeUnderflow = true;
  } else if (typeof max === 'number' && count > max) {
    validity.rangeOverflow = true;
  }
};
