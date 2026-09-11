import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

import { initViewSettingsStorage } from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';
import { currentView } from '$lib/services/contents/collection/view';
import { createRawState, createRootEffect } from '$lib/services/utils/state.svelte';

/**
 * @import { BackendService, EntryListView } from '$lib/types/private';
 */

/**
 * View settings for all the entry collections.
 * @type {{ current: Record<string, EntryListView> | undefined }}
 */
export const entryListSettings = createRawState();

/**
 * Initialize {@link entryListSettings} and relevant effects.
 * @param {BackendService} _backend Backend service.
 */
export const initSettings = async ({ repository }) => {
  await initViewSettingsStorage(repository, 'contents-view', entryListSettings);

  // Save the view settings when the view is changed
  createRootEffect(() => {
    const view = currentView.current;

    untrack(() => {
      const { name } = selectedCollection.current ?? {};
      const savedView = entryListSettings.current?.[name ?? ''] ?? {};

      if (name && !equal(view, savedView)) {
        entryListSettings.current = { ...entryListSettings.current, [name]: view };
      }
    });
  });
};
