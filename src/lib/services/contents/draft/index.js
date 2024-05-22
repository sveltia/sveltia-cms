import { get, writable } from 'svelte/store';
import { prefs } from '$lib/services/prefs';

/**
 * @type {import('svelte/store').Writable<EntryDraft | null | undefined>}
 */
export const entryDraft = writable();
/**
 * Whether to enable automatic i18n duplication in proxies in {@link entryDraft}. This can be
 * temporarily disabled for performance reasons when making large changes to the values.
 */
export const i18nAutoDupEnabled = writable(true);

entryDraft.subscribe((draft) => {
  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('entryDraft', draft);
  }
});
