import { validateEntry } from '$lib/services/contents/draft/validate';
import { awaitCustomFieldValidations } from '$lib/services/contents/draft/validate/custom-fields';
import { expandInvalidFields } from '$lib/services/contents/editor/fields';
import { awaitPendingFieldUpdates } from '$lib/services/contents/editor/pending';

/**
 * @import {
 * EntryDraft,
 * FlattenedEntryValidityStateMap,
 * LocaleValidityMap,
 * } from '$lib/types/private';
 */

/**
 * Validate the given draft, update the validity for all the fields in it, and expand the invalid
 * fields so the errors are visible.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft to validate.
 * @param {boolean} [args.enforceRequired] Whether an empty required field makes the entry invalid.
 * See {@link validateEntry}.
 * @returns {boolean} Whether the entry draft is valid.
 */
export const revealInvalidFields = ({ draft, enforceRequired = true }) => {
  if (validateEntry({ draft, enforceRequired })) {
    return true;
  }

  expandInvalidFields({ draft });

  return false;
};

/**
 * Wait for the field values and the custom field validations to settle, then validate the given
 * draft and expand the invalid fields, as a save does.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft to validate.
 * @param {boolean} [args.enforceRequired] Whether an empty required field makes the entry invalid.
 * See {@link validateEntry}.
 * @param {boolean} [args.awaitFieldUpdates] Whether to wait for the field editors to write what was
 * just typed to the draft. A rich text editor does so with a short delay, so validating right after
 * typing would otherwise check the field’s previous value.
 * @returns {Promise<boolean>} Whether the entry draft is valid.
 */
export const validateAndRevealErrors = async ({
  draft,
  enforceRequired = true,
  awaitFieldUpdates = true,
}) => {
  if (awaitFieldUpdates) {
    await awaitPendingFieldUpdates();
  }

  // Custom field validators can be async, so wait for any in-flight results before validating.
  // Otherwise a field made invalid moments ago would be validated against a stale verdict.
  await awaitCustomFieldValidations();

  return revealInvalidFields({ draft, enforceRequired });
};

/**
 * Check whether any of the fields in the given validity map of a locale is invalid.
 * @param {FlattenedEntryValidityStateMap | undefined} validityMap Validity of each field, keyed by
 * key path.
 * @returns {boolean} Result.
 */
export const hasInvalidFields = (validityMap) =>
  Object.values(validityMap ?? {}).some(({ valid }) => !valid);

/**
 * Count the invalid fields across all the locales in the given validity map.
 * @param {LocaleValidityMap} validities Validity of each field, keyed by locale and key path.
 * @returns {number} Number of invalid fields.
 */
export const countInvalidFields = (validities) =>
  Object.values(validities).flatMap((validityMap) =>
    Object.values(validityMap).filter(({ valid }) => !valid),
  ).length;
