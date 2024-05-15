import { get, writable } from 'svelte/store';
import { prefs } from '$lib/services/prefs';

/**
 * @type {import('svelte/store').Writable<EntryDraft | null | undefined>}
 */
export const entryDraft = writable();

entryDraft.subscribe((draft) => {
  if (get(prefs).devModeEnabled) {
    // eslint-disable-next-line no-console
    console.info('entryDraft', draft);
  }
});
