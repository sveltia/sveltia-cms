import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

import { initViewSettingsStorage } from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';
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
 * View settings for the selected entry collection.
 * @type {{ current: EntryListView }}
 */
export const currentView = createRawState({ type: 'list' });

/**
 * View of an entry collection as it was when reorder mode was entered, restored when the mode is
 * exited. `undefined` while not in reorder mode. It’s saved in place of the view applied for
 * reordering, so the user’s own view isn’t lost if the page is reloaded or another collection is
 * selected before reordering is over. This is a plain object, as nothing has to react to it.
 * @type {{ current: { collectionName: string | undefined, view: EntryListView } | undefined }}
 */
export const viewBeforeReorder = { current: undefined };

/**
 * Initialize {@link entryListSettings} and relevant effects.
 * @param {BackendService} _backend Backend service.
 */
export const initSettings = async ({ repository }) => {
  await initViewSettingsStorage(repository, 'contents-view', entryListSettings);

  // Save the view settings when the view is changed
  createRootEffect(() => {
    const _view = currentView.current;

    untrack(() => {
      const { name } = selectedCollection.current ?? {};
      const snapshot = viewBeforeReorder.current;
      const view = snapshot && snapshot.collectionName === name ? snapshot.view : _view;
      const savedView = entryListSettings.current?.[name ?? ''] ?? {};

      if (name && !equal(view, savedView)) {
        entryListSettings.current = { ...entryListSettings.current, [name]: view };
      }
    });
  });
};
