import { get } from 'svelte/store';

import { entryDraft } from '$lib/services/contents/draft';

/**
 * @import { EntryDraft, LocaleValidityMap } from '$lib/types/private';
 */

/**
 * Validate the slugs and return the results. At this time, we only check if the slug is empty when
 * the slug editor is shown.
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
    const slugEnabled = !!currentLocales?.[locale] && !!slugEditor[locale];
    const valueMissing = slugEnabled && !slug?.trim();
    // A pattern mismatch is when the slug contains a forward slash or whitespace. This is not
    // allowed because it would break the URL structure. A more detailed pattern check based on the
    // global `slug` options can be added later if needed.
    const patternMismatch = slugEnabled && /[/\s]/.test(slug ?? '');
    const invalid = valueMissing || patternMismatch;

    if (invalid) {
      valid = false;
    }

    validities[locale] = { _slug: { valueMissing, patternMismatch, valid: !invalid } };
  });

  return { valid, validities };
};
