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
