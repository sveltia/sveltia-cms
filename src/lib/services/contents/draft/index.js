import equal from 'fast-deep-equal';
import { derived, writable } from 'svelte/store';

import { prefs } from '$lib/services/user/prefs.svelte';

/**
 * Regex to match internal properties added to list items, which should be excluded from output.
 */
export const INTERNAL_PROP_REGEX = /\.__sc_\w+$/;

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { EntryDraft, FlattenedEntryContent, LocaleContentMap } from '$lib/types/private';
 */

/**
 * @type {Writable<EntryDraft | null | undefined>}
 */
export const entryDraft = writable();

/**
 * Whether to enable automatic i18n duplication in proxies in {@link entryDraft}. This can be
 * temporarily disabled for performance reasons when making large changes to the values.
 */
export const i18nAutoDupEnabled = writable(true);

/**
 * Whether the user has manually interacted with the entry editor. This prevents auto-backup from
 * triggering when only programmatic changes (e.g. Lexical markdown reformatting) have occurred.
 */
export const entryDraftInteracted = writable(false);

/**
 * Filter out internal properties from a value map.
 * @param {FlattenedEntryContent} valueMap The value map to filter.
 * @returns {FlattenedEntryContent} The filtered value map.
 */
export const filterRealValues = (valueMap) =>
  Object.fromEntries(Object.entries(valueMap).filter(([key]) => !INTERNAL_PROP_REGEX.test(key)));

/**
 * Compare a locale’s original and current value maps, ignoring internal properties in the current
 * one. Equivalent to deep-comparing {@link filterRealValues} of the current map against the
 * original, but without building the filtered copy first.
 * @param {FlattenedEntryContent} originalValueMap Original values for the locale.
 * @param {FlattenedEntryContent} currentValueMap Current values for the locale.
 * @returns {boolean} Whether the values differ.
 */
const isValueMapModified = (originalValueMap, currentValueMap) => {
  let realKeyCount = 0;

  const anyValueChanged = Object.keys(currentValueMap).some((key) => {
    if (INTERNAL_PROP_REGEX.test(key)) {
      return false;
    }

    realKeyCount += 1;

    return (
      !Object.hasOwn(originalValueMap, key) || !equal(originalValueMap[key], currentValueMap[key])
    );
  });

  // Also catch keys that only exist in the original map, which the loop above cannot see
  return anyValueChanged || Object.keys(originalValueMap).length !== realKeyCount;
};

/**
 * Compare the original and current values of every locale in the draft.
 * @param {LocaleContentMap} originalValues Original values.
 * @param {LocaleContentMap} currentValues Current values.
 * @returns {boolean} Whether the values differ.
 */
const areValuesModified = (originalValues, currentValues) => {
  const currentLocales = Object.keys(currentValues);

  if (currentLocales.length !== Object.keys(originalValues).length) {
    return true;
  }

  return currentLocales.some((locale) => {
    const originalValueMap = originalValues[locale];

    return !originalValueMap || isValueMapModified(originalValueMap, currentValues[locale]);
  });
};

/**
 * Whether the current {@link entryDraft} has been modified.
 *
 * This is recomputed on every draft update — so on every keystroke in the editor — hence the
 * hand-rolled value comparison instead of deep-comparing a filtered copy of the whole content.
 * @type {Readable<boolean>}
 */
export const entryDraftModified = derived([entryDraft], ([draft]) => {
  if (!draft) {
    return false;
  }

  const {
    originalLocales,
    currentLocales,
    originalSlugs,
    currentSlugs,
    originalValues,
    currentValues,
  } = draft;

  return (
    !equal(originalLocales, currentLocales) ||
    !equal(originalSlugs, currentSlugs) ||
    // Internal properties are excluded from the value comparison
    areValuesModified(originalValues, currentValues)
  );
});

entryDraft.subscribe((draft) => {
  if (prefs.devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('entryDraft', draft);
  }
});
