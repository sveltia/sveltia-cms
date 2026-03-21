import equal from 'fast-deep-equal';
import { get, writable } from 'svelte/store';

import { initViewSettingsStorage } from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';
import { currentView } from '$lib/services/contents/collection/view';

/**
 * @import { Writable } from 'svelte/store';
 * @import { BackendService, EntryListView } from '$lib/types/private';
 */

/**
 * View settings for all the entry collections.
 * @type {Writable<Record<string, EntryListView> | undefined>}
 */
export const entryListSettings = writable();

/**
 * Initialize {@link entryListSettings} and relevant subscribers.
 * @param {BackendService} _backend Backend service.
 */
export const initSettings = async ({ repository }) => {
  await initViewSettingsStorage(repository, 'contents-view', entryListSettings);

  currentView.subscribe((view) => {
    const { name } = get(selectedCollection) ?? {};
    const savedView = get(entryListSettings)?.[name ?? ''] ?? {};

    if (name && !equal(view, savedView)) {
      entryListSettings.update((_settings) => ({ ..._settings, [name]: view }));
    }
  });
};
