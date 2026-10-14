import equal from 'fast-deep-equal';
import { untrack } from 'svelte';

import { initViewSettingsStorage } from '$lib/services/common/view';
import { selectedCollection } from '$lib/services/contents/collection';
import { hasConfiguredTableColumns } from '$lib/services/contents/collection/view/table';
import { createRawState, createRootEffect } from '$lib/services/utils/state.svelte';

/**
 * @import {
 * BackendService,
 * EntryListView,
 * InternalEntryCollection,
 * ViewType,
 * } from '$lib/types/private';
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
 * Get the view types offered for an entry collection, the first one being the default, which
 * applies until the user picks one. The table view is only offered if the collection has its
 * columns configured with the `table_columns` option, or its alias `summary_fields`, and the grid
 * view if its entries have thumbnails.
 * @param {InternalEntryCollection | undefined} collection Entry collection.
 * @returns {ViewType[]} View types.
 */
export const getEntryViewTypes = (collection) => [
  ...(collection && hasConfiguredTableColumns(collection) ? /** @type {const} */ (['table']) : []),
  'list',
  ...(collection?._thumbnailFieldNames.length ? /** @type {const} */ (['grid']) : []),
];

/**
 * Get the view type the entry list is shown in. The default applies until the user picks one, and
 * also to a saved view that isn’t offered anymore, e.g. the grid view of a collection that no
 * longer has thumbnails. The list view is used instead of the table view on a screen too small for
 * it, and always in reorder mode.
 * @param {object} args Arguments.
 * @param {ViewType} [args.type] View type the user has picked, if any.
 * @param {ViewType[]} args.types View types offered. See {@link getEntryViewTypes}.
 * @param {boolean} args.isLargeScreen Whether the screen is large enough for the table view.
 * @param {boolean} [args.reordering] Whether the entry list is in reorder mode.
 * @returns {ViewType} View type.
 */
export const getEntryViewType = ({ type, types, isLargeScreen, reordering = false }) => {
  if (reordering) {
    return 'list';
  }

  const resolved = type && types.includes(type) ? type : types[0];

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
