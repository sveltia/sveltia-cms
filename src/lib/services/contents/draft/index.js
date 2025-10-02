import equal from 'fast-deep-equal';
import { derived, get, writable } from 'svelte/store';

import { prefs } from '$lib/services/user/prefs';

/**
 * @import { Readable, Writable } from 'svelte/store';
 * @import { EntryDraft } from '$lib/types/private';
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

  return (
    !equal(originalLocales, currentLocales) ||
    !equal(originalSlugs, currentSlugs) ||
    !equal(originalValues, currentValues)
  );
});

entryDraft.subscribe((draft) => {
  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('entryDraft', draft);
  }
});
