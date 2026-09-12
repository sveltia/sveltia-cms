import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

import { selectedCloudService } from '$lib/services/assets/external';
import { selectedAssetFolder } from '$lib/services/assets/folders';
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
 * Default view settings for the selected asset collection.
 * @type {AssetListView}
 */
export const defaultView = {
  type: 'grid',
  showInfo: true,
  sort: {
    key: 'name',
    order: 'ascending',
  },
};

/**
 * View settings for the selected asset collection.
 * @type {{ current: AssetListView }}
 */
export const currentView = createRawState({ type: 'grid', showInfo: true });

/**
 * Get the key under which the view settings for the selected location are saved: the internal
 * path of a repository folder, `-/{serviceId}` for a cloud storage service, or `*` for All Assets.
 * @returns {string} Key.
 */
export const getSettingsKey = () => {
  const service = selectedCloudService.current;

  if (service) {
    return `-/${service.serviceId}`;
  }

  return selectedAssetFolder.current?.internalPath ?? '*';
};

/**
 * Initialize {@link assetListSettings} and relevant effects.
 * @param {BackendService} _backend Backend service.
 */
export const initSettings = async ({ repository }) => {
  await initViewSettingsStorage(repository, 'assets-view', assetListSettings);

  // Restore the view settings when a different folder or service is selected
  createRootEffect(() => {
    void [selectedAssetFolder.current, selectedCloudService.current];

    untrack(() => {
      const view = assetListSettings.current?.[getSettingsKey()] ?? structuredClone(defaultView);

      if (!equal(view, currentView.current)) {
        currentView.current = view;
      }
    });
  });

  // Save the view settings when the view is changed
  createRootEffect(() => {
    const view = currentView.current;

    untrack(() => {
      const key = getSettingsKey();
      const savedView = assetListSettings.current?.[key] ?? {};

      if (!equal(view, savedView)) {
        assetListSettings.current = { ...assetListSettings.current, [key]: view };
      }
    });
  });
};
