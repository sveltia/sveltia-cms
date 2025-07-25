import { IndexedDB } from '@sveltia/utils/storage';
import equal from 'fast-deep-equal';
import { get, writable } from 'svelte/store';
import { selectedAssetFolder } from '$lib/services/assets/folders';
import { currentView, defaultView } from '$lib/services/assets/view';
import { backend } from '$lib/services/backends';

/**
 * @import { Writable } from 'svelte/store';
 * @import { AssetListView, BackendService } from '$lib/types/private';
 */

/**
 * View settings for all the asset collection.
 * @type {Writable<Record<string, AssetListView> | undefined>}
 */
const assetListSettings = writable();

/**
 * Initialize {@link assetListSettings} and relevant subscribers.
 * @param {BackendService} _backend Backend service.
 */
export const initSettings = async ({ repository }) => {
  const { databaseName } = repository ?? {};
  const settingsDB = databaseName ? new IndexedDB(databaseName, 'ui-settings') : null;
  const storageKey = 'assets-view';

  assetListSettings.set((await settingsDB?.get(storageKey)) ?? {});

  assetListSettings.subscribe((_settings) => {
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

  selectedAssetFolder.subscribe((folder) => {
    const view =
      get(assetListSettings)?.[folder?.internalPath ?? '*'] ?? structuredClone(defaultView);

    if (!equal(view, get(currentView))) {
      currentView.set(view);
    }
  });

  currentView.subscribe((view) => {
    const path = get(selectedAssetFolder)?.internalPath ?? '*';
    const savedView = get(assetListSettings)?.[path] ?? {};

    if (!equal(view, savedView)) {
      assetListSettings.update((_settings) => ({ ..._settings, [path]: view }));
    }
  });
};

backend.subscribe((_backend) => {
  if (_backend && !get(assetListSettings)) {
    initSettings(_backend);
  }
});
