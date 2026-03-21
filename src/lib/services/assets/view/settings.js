import equal from 'fast-deep-equal';
import { get, writable } from 'svelte/store';

import { selectedAssetFolder } from '$lib/services/assets/folders';
import { currentView, defaultView } from '$lib/services/assets/view';
import { initViewSettingsStorage } from '$lib/services/common/view';

/**
 * @import { Writable } from 'svelte/store';
 * @import { AssetListView, BackendService } from '$lib/types/private';
 */

/**
 * View settings for all the asset collection.
 * @type {Writable<Record<string, AssetListView> | undefined>}
 */
export const assetListSettings = writable();

/**
 * Initialize {@link assetListSettings} and relevant subscribers.
 * @internal
 * @param {BackendService} _backend Backend service.
 */
export const initSettings = async ({ repository }) => {
  await initViewSettingsStorage(repository, 'assets-view', assetListSettings);

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
