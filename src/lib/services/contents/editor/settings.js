import { IndexedDB } from '@sveltia/utils/storage';
import equal from 'fast-deep-equal';
import { get, writable } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { selectAssetsView } from '$lib/services/contents/editor';

/**
 * @import { Writable } from 'svelte/store';
 * @import { BackendService, EntryEditorView } from '$lib/types/private';
 */

/**
 * @type {Writable<EntryEditorView | undefined>}
 */
export const entryEditorSettings = writable();

/**
 * Store unsubscribe functions to prevent memory leaks.
 * @type {{ entryEditorSettingsUnsubscribe?: () => void, selectAssetsViewUnsubscribe?: () => void }}
 */
const unsubscribers = {};

/**
 * Initialize {@link entryEditorSettings}, {@link selectAssetsView} and relevant subscribers.
 * @param {BackendService} _backend Backend service.
 */
export const initSettings = async ({ repository }) => {
  const { databaseName } = repository ?? {};
  const settingsDB = databaseName ? new IndexedDB(databaseName, 'ui-settings') : null;
  const storageKey = 'entry-view';

  const settings = {
    showPreview: true,
    syncScrolling: true,
    selectAssetsView: { type: 'grid' },
    ...(await settingsDB?.get(storageKey)),
  };

  entryEditorSettings.set(settings);
  selectAssetsView.set(settings.selectAssetsView);

  // Unsubscribe from previous subscribers to prevent memory leaks
  unsubscribers.entryEditorSettingsUnsubscribe?.();
  unsubscribers.selectAssetsViewUnsubscribe?.();

  unsubscribers.entryEditorSettingsUnsubscribe = entryEditorSettings.subscribe((_settings) => {
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

  unsubscribers.selectAssetsViewUnsubscribe = selectAssetsView.subscribe((view) => {
    if (!view || !Object.keys(view).length) {
      return;
    }

    const savedView = get(entryEditorSettings)?.selectAssetsView ?? {};

    if (!equal(view, savedView)) {
      entryEditorSettings.update((_settings) => ({ ..._settings, selectAssetsView: view }));
    }
  });
};

backend.subscribe((_backend) => {
  if (_backend && !get(entryEditorSettings)) {
    initSettings(_backend);
  }
});
