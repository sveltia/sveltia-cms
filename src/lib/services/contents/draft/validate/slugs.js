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
  const { currentSlugs, slugEditor } = /** @type {EntryDraft} */ (get(entryDraft));
  /** @type {LocaleValidityMap} */
  const validities = {};
  let valid = true;

  Object.entries(currentSlugs).forEach(([locale, slug]) => {
    const valueMissing = !!slugEditor[locale] && !slug?.trim();

    if (valueMissing) {
      valid = false;
    }

    validities[locale] = { _slug: { valueMissing, valid: !valueMissing } };
  });

  return { valid, validities };
};
