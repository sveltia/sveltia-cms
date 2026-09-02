import { get } from 'svelte/store';

import { entryDraft } from '$lib/services/contents/draft';
import { validateFields } from '$lib/services/contents/draft/validate/fields';
import { validateSlugs } from '$lib/services/contents/draft/validate/slugs';

/**
 * @import { Writable } from 'svelte/store';
 * @import {
 * EntryDraft,
 * LocaleValidationMessagesMap,
 * LocaleValidityMap,
 * } from '$lib/types/private';
 */

/**
 * Validate the given entry draft and return the results, without touching any application state.
 * The draft doesn’t have to be the one open in the editor: an entry shown on the Editorial Workflow
 * board can be checked with a throwaway draft built from its content.
 * @param {object} args Arguments.
 * @param {EntryDraft} args.draft Draft to validate.
 * @param {boolean} [args.enforceRequired] Whether an empty required field is an error. Set to
 * `false` to save an Editorial Workflow draft that hasn’t been filled in yet, which leaves those
 * fields unmarked: the save succeeds, so the editor has nothing to report.
 * @returns {{ valid: boolean, validities: LocaleValidityMap,
 * validationMessages: LocaleValidationMessagesMap }} Validation results.
 */
export const validateDraft = ({ draft, enforceRequired = true }) => {
  const {
    valid: currentValuesValid,
    validities: currentValuesValidities,
    validationMessages: currentValuesMessages,
  } = validateFields('currentValues', { enforceRequired, draft });

  const {
    valid: extraValuesValid,
    validities: extraValuesValidities,
    validationMessages: extraValuesMessages,
  } = validateFields('extraValues', { enforceRequired, draft });

  // The slug is what the entry’s file is named after, so an empty or malformed one blocks the save
  // whether or not the entry is complete
  const { valid: slugsValid, validities: slugsValidities } = validateSlugs(draft);

  return {
    valid: currentValuesValid && extraValuesValid && slugsValid,
    validities: Object.fromEntries(
      Object.keys(currentValuesValidities).map((locale) => [
        locale,
        {
          ...currentValuesValidities[locale],
          ...extraValuesValidities[locale],
          ...slugsValidities[locale],
        },
      ]),
    ),
    validationMessages: Object.fromEntries(
      Object.keys(currentValuesMessages).map((locale) => [
        locale,
        {
          ...currentValuesMessages[locale],
          ...extraValuesMessages[locale],
        },
      ]),
    ),
  };
};

/**
 * Validate the field values, update the validity for all the fields, and return the final results
 * as a boolean.
 * @param {object} [options] Options.
 * @param {boolean} [options.enforceRequired] Whether an empty required field makes the entry
 * invalid. See {@link validateDraft}.
 * @returns {boolean} Whether the entry draft is valid.
 */
export const validateEntry = ({ enforceRequired = true } = {}) => {
  const draft = /** @type {EntryDraft} */ (get(entryDraft));
  const { valid, validities, validationMessages } = validateDraft({ draft, enforceRequired });

  /** @type {Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({
    ..._draft,
    validities,
    validationMessages,
  }));

  return valid;
};
