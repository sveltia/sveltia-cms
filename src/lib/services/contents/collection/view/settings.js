import { IndexedDB } from '@sveltia/utils/storage';
import equal from 'fast-deep-equal';
import { get, writable } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { selectedCollection } from '$lib/services/contents/collection';
import { currentView } from '$lib/services/contents/collection/view';

/**
 * @import { Writable } from 'svelte/store';
 * @import { BackendService, EntryListView } from '$lib/types/private';
 */

/**
 * View settings for all the folder collections.
 * @type {Writable<Record<string, EntryListView> | undefined>}
 */
export const entryListSettings = writable();

/**
 * Initialize {@link entryListSettings} and relevant subscribers.
 * @param {BackendService} _backend Backend service.
 */
export const initSettings = async ({ repository }) => {
  const { databaseName } = repository ?? {};
  const settingsDB = databaseName ? new IndexedDB(databaseName, 'ui-settings') : null;
  const storageKey = 'contents-view';

  entryListSettings.set((await settingsDB?.get(storageKey)) ?? {});

  entryListSettings.subscribe((_settings) => {
    (async () => {
      try {
        if (!equal(_settings, await settingsDB?.get(storageKey))) {
          await settingsDB?.set(storageKey, _settings);
        }
      } catch {
        //
      }
    })();
  });

  currentView.subscribe((view) => {
    const { name } = get(selectedCollection) ?? {};
    const savedView = get(entryListSettings)?.[name ?? ''] ?? {};

    if (name && !equal(view, savedView)) {
      entryListSettings.update((_settings) => ({ ..._settings, [name]: view }));
    }
  });
};

backend.subscribe((_backend) => {
  if (_backend && !get(entryListSettings)) {
    initSettings(_backend);
  }
});
