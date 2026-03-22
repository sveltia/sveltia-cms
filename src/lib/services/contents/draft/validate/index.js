import { entryDraft } from '$lib/services/contents/draft';
import { validateFields } from '$lib/services/contents/draft/validate/fields';
import { validateSlugs } from '$lib/services/contents/draft/validate/slugs';

/**
 * @import { Writable } from 'svelte/store';
 * @import { EntryDraft } from '$lib/types/private';
 */

/**
 * Validate the field values, update the validity for all the fields, and return the final results
 * as a boolean.
 * @returns {boolean} Whether the entry draft is valid.
 */
export const validateEntry = () => {
  const {
    valid: currentValuesValid,
    validities: currentValuesValidities,
    validationMessages: currentValuesMessages,
  } = validateFields('currentValues');

  const {
    valid: extraValuesValid,
    validities: extraValuesValidities,
    validationMessages: extraValuesMessages,
  } = validateFields('extraValues');

  const { valid: slugsValid, validities: slugsValidities } = validateSlugs();

  /** @type {Writable<EntryDraft>} */ (entryDraft).update((_draft) => ({
    ..._draft,
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
  }));

  return currentValuesValid && extraValuesValid && slugsValid;
};
