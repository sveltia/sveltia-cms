import equal from 'fast-deep-equal';
import { derived, get, writable } from 'svelte/store';

import { prefs } from '$lib/services/user/prefs';

/**
 * Regex to match internal properties added to list items, which should be excluded from output.
 */
export const INTERNAL_PROP_REGEX = /\.__sc_\w+$/;

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { EntryDraft, FlattenedEntryContent } from '$lib/types/private';
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
 * Whether the current {@link entryDraft} has been modified.
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

  // Exclude internal properties from the value comparison
  const currentRealValues = Object.fromEntries(
    Object.entries(currentValues).map(([locale, valueMap]) => [locale, filterRealValues(valueMap)]),
  );

  return (
    !equal(originalLocales, currentLocales) ||
    !equal(originalSlugs, currentSlugs) ||
    !equal(originalValues, currentRealValues)
  );
});

entryDraft.subscribe((draft) => {
  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('entryDraft', draft);
  }
});
