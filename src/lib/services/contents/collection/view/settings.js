import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

import { initViewSettingsStorage } from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';
import { createRawState, createRootEffect } from '$lib/services/utils/state.svelte';

/**
 * @import { BackendService, EntryListView, ViewType } from '$lib/types/private';
 */

/**
 * View settings for all the entry collections.
 * @type {{ current: Record<string, EntryListView> | undefined }}
 */
export const entryListSettings = createRawState();

/**
 * View settings for the selected entry collection. The view type is left out until the user picks
 * one, so the default applies, and isn’t saved as if the user had chosen it. See
 * {@link getEntryViewType}.
 * @type {{ current: EntryListView }}
 */
export const currentView = createRawState({});

/**
 * Get the view type the entry list is shown in. The table view is the default, until the user picks
 * another one. The list view is used instead of the table view on a screen too small for it, and
 * always in reorder mode. A grid view saved for a collection that no longer has thumbnails falls
 * back to the default.
 * @param {object} args Arguments.
 * @param {ViewType} [args.type] View type the user has picked, if any.
 * @param {boolean} args.hasThumbnails Whether the collection’s entries have thumbnails.
 * @param {boolean} args.isLargeScreen Whether the screen is large enough for the table view.
 * @param {boolean} [args.reordering] Whether the entry list is in reorder mode.
 * @returns {ViewType} View type.
 */
export const getEntryViewType = ({ type, hasThumbnails, isLargeScreen, reordering = false }) => {
  if (reordering) {
    return 'list';
  }

  const resolved = !type || (type === 'grid' && !hasThumbnails) ? 'table' : type;

  return resolved === 'table' && !isLargeScreen ? 'list' : resolved;
};

/**
 * View of an entry collection as it was when reorder mode was entered, restored when the mode is
 * exited. `undefined` while not in reorder mode. It’s saved in place of the view applied for
 * reordering, so the user’s own view isn’t lost if the page is reloaded or another collection is
 * selected before reordering is over. This is a plain object, as nothing has to react to it.
 * @type {{ current: { collectionName: string | undefined, view: EntryListView } | undefined }}
 */
export const viewBeforeReorder = { current: undefined };

/**
 * Get a key that changes whenever the given view would put the entries in another order or pick
 * other entries: its sorting, filtering or grouping conditions. The entry list starts again from
 * the top when it changes, rather than keeping every row rendered so far, which after a long scroll
 * can be thousands of rows for the new order to render all at once. The view type and the
 * collapsed groups are left out, as they leave the entries where they are.
 * @param {EntryListView} view View.
 * @returns {string} Key.
 */
export const getEntryOrderKey = ({ sort, filter, filters, group }) =>
  JSON.stringify([sort, filter, filters, group]);

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
