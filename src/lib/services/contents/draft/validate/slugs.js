import { get } from 'svelte/store';

import { entryDraft } from '$lib/services/contents/draft';

/**
 * @import { EntryDraft, LocaleValidityMap } from '$lib/types/private';
 */

/**
 * Validate the slugs and return the results. At this time, we only check if the slug is empty when
 * the slug editor is shown. A pattern check can be added later if needed.
 * @internal
 * @returns {{ valid: boolean, validities: LocaleValidityMap }} Validation results.
 */
export const validateSlugs = () => {
  const { currentLocales, currentSlugs, slugEditor } = /** @type {EntryDraft} */ (get(entryDraft));
  /** @type {LocaleValidityMap} */
  const validities = {};
  let valid = true;

  Object.entries(currentSlugs).forEach(([locale, slug]) => {
    // Only validate slugs for locales that are currently enabled. A disabled locale’s slug is not
    // written to disk, so an empty value should not block saving.
    // @see https://github.com/sveltia/sveltia-cms/issues/740
    const valueMissing = !!currentLocales?.[locale] && !!slugEditor[locale] && !slug?.trim();

    if (valueMissing) {
      valid = false;
    }

    validities[locale] = { _slug: { valueMissing, valid: !valueMissing } };
  });

  return { valid, validities };
};
