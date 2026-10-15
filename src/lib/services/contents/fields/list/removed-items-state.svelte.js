import equal from 'fast-deep-equal';

import { getListItemKey } from '$lib/services/contents/fields/list/helpers';
import {
  addRemovedItem,
  dropRestoredItem,
  shiftRemovedItems,
} from '$lib/services/contents/fields/list/removed-items';

/**
 * @import { InternalLocaleCode, RemovedListItem } from '$lib/types/private';
 */

/**
 * State of the items removed from a List field, created with {@link createRemovedItemsState}.
 * @typedef {object} RemovedItemsState
 * @property {RemovedListItem[]} shown The removed items to show, unless they’re out of place.
 * @property {Map<number, RemovedListItem[]>} byIndex The removed items to show, grouped by the
 * position they’re shown at.
 * @property {(valueList: any[], targetLocale: InternalLocaleCode) => void} remember Remember the
 * item keys of the list in the locale being edited, once it’s been manipulated here.
 * @property {(removedItem: RemovedListItem) => void} add Add an item that has just been removed.
 * @property {(id: string) => void} drop Drop an item that has just been restored.
 * @property {(index: number) => void} shift Move the removed items along with the items after the
 * one just added at the position.
 */

/**
 * Create the state of the items removed from a List field since the editor was opened, which are
 * shown in their place with a button to restore them. Use it in a component.
 * @param {object} args Arguments.
 * @param {() => InternalLocaleCode} args.getLocale Get the locale being edited.
 * @param {() => (string | number)[]} args.getItemKeys Get the current keys of the list items.
 * @returns {RemovedItemsState} State.
 */
export const createRemovedItemsState = ({ getLocale, getItemKeys }) => {
  /**
   * Items removed since the editor was opened, which are shown in their place with a button to
   * restore them.
   * @type {RemovedListItem[]}
   */
  let removedItems = $state.raw([]);
  /**
   * Locale and item keys after the last item was removed, restored or added here, to tell whether
   * the editor has since been switched to another locale, or the list changed elsewhere, e.g.
   * reverted, which leaves the removed items out of place. The object items are given an ID as one
   * is removed, so a revert, which brings back the original items without the IDs, changes the keys
   * even if the item count stays the same.
   * @type {{ locale: InternalLocaleCode, keys: (string | number)[] } | undefined}
   */
  let expectedListState = $state.raw();

  /** The removed items to show, unless they’re out of place. */
  const shown = $derived(
    expectedListState?.locale === getLocale() && equal(expectedListState.keys, getItemKeys())
      ? removedItems
      : [],
  );

  /** The removed items grouped by the position they’re shown at. */
  const byIndex = $derived(Map.groupBy(shown, ({ index }) => index));

  return {
    /**
     * The removed items to show.
     * @returns {RemovedListItem[]} Items.
     */
    get shown() {
      return shown;
    },
    /**
     * The removed items to show, grouped by position.
     * @returns {Map<number, RemovedListItem[]>} Map.
     */
    get byIndex() {
      return byIndex;
    },
    /**
     * Remember the item keys of the list once it’s been manipulated here.
     * @param {any[]} valueList Manipulated list.
     * @param {InternalLocaleCode} targetLocale Locale the list is for.
     */
    remember: (valueList, targetLocale) => {
      const locale = getLocale();

      if (targetLocale === locale) {
        expectedListState = {
          locale,
          keys: valueList.map((_item, index) => getListItemKey(valueList, index)),
        };
      }
    },
    /**
     * Add an item that has just been removed.
     * @param {RemovedListItem} removedItem Item.
     */
    add: (removedItem) => {
      removedItems = addRemovedItem(shown, removedItem);
    },
    /**
     * Drop an item that has just been restored.
     * @param {string} id ID of the item.
     */
    drop: (id) => {
      removedItems = dropRestoredItem(shown, id);
    },
    /**
     * Move the removed items along with the items after the one just added.
     * @param {number} index Position the new item was added to.
     */
    shift: (index) => {
      removedItems = shiftRemovedItems(shown, index);
    },
  };
};
