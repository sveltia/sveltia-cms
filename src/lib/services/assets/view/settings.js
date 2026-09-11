import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

import { selectedAssetFolder } from '$lib/services/assets/folders';
import { currentView, defaultView } from '$lib/services/assets/view';
import { initViewSettingsStorage } from '$lib/services/common/view';
import { createRawState, createRootEffect } from '$lib/services/utils/state.svelte';

/**
 * @import { AssetListView, BackendService } from '$lib/types/private';
 */

/**
 * View settings for all the asset collection.
 * @type {{ current: Record<string, AssetListView> | undefined }}
 */
export const assetListSettings = createRawState();

/**
 * Initialize {@link assetListSettings} and relevant effects.
 * @param {BackendService} _backend Backend service.
 */
export const initSettings = async ({ repository }) => {
  await initViewSettingsStorage(repository, 'assets-view', assetListSettings);

  // Restore the view settings when a different folder is selected
  createRootEffect(() => {
    const folder = selectedAssetFolder.current;

    untrack(() => {
      const view =
        assetListSettings.current?.[folder?.internalPath ?? '*'] ?? structuredClone(defaultView);

      if (!equal(view, currentView.current)) {
        currentView.current = view;
      }
    });
  });

  // Save the view settings when the view is changed
  createRootEffect(() => {
    const view = currentView.current;

    untrack(() => {
      const path = selectedAssetFolder.current?.internalPath ?? '*';
      const savedView = assetListSettings.current?.[path] ?? {};

      if (!equal(view, savedView)) {
        assetListSettings.current = { ...assetListSettings.current, [path]: view };
      }
    });
  });
};
