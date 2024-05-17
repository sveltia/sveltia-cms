import { get, writable } from 'svelte/store';
import { prefs } from '$lib/services/prefs';

/**
 * @type {import('svelte/store').Writable<EntryDraft | null | undefined>}
 */
export const entryDraft = writable();
/**
 * Whether to enable the i18n duplication in proxies in {@link entryDraft}. This can be temporarily
 * disabled for performance when doing a mass copy.
 */
export const i18nDuplicationEnabled = writable(true);

entryDraft.subscribe((draft) => {
  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('entryDraft', draft);
  }
});
