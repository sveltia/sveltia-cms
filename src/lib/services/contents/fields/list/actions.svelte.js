import { _ } from '@sveltia/i18n';
import { sleep } from '@sveltia/utils/misc';

import { updateListFieldForLocales } from '$lib/services/contents/draft/update/list';
import { isExpanded, syncExpanderStates } from '$lib/services/contents/editor/fields';
import {
  getStickyToolbarBottom,
  scrollToAddedListItem,
} from '$lib/services/contents/editor/scroll';
import {
  copyListItem,
  prepareListItemPaste,
  readListItem,
} from '$lib/services/contents/fields/list/clipboard';
import { getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
import {
  createListItem,
  getInitialListExpanderStates,
} from '$lib/services/contents/fields/list/items';
import {
  insertListItem,
  moveListItem,
  removeListItem,
  restoreListItem,
} from '$lib/services/contents/fields/list/mutations';
import {
  getPastedItemToast,
  showListItemClipboardToast,
} from '$lib/services/contents/fields/list/paste-toast';
import { getNestedExpanderStates } from '$lib/services/contents/fields/list/removed-items';

/**
 * @import { EntryDraftState } from '$lib/services/contents/draft/state.svelte';
 * @import {
 * RemovedItemsState,
 * } from '$lib/services/contents/fields/list/removed-items-state.svelte';
 * @import { resolveVariableType } from '$lib/services/contents/fields/object/helpers';
 * @import {
 * DraftValueStoreKey,
 * EntryDraft,
 * ExpanderStateList,
 * InternalLocaleCode,
 * RemovedListItem,
 * TypedFieldKeyPath,
 * } from '$lib/types/private';
 * @import {
 * ComplexListField,
 * FieldKeyPath,
 * ListFieldWithSubField,
 * ListFieldWithTypes,
 * } from '$lib/types/public';
 */

/**
 * What the actions need to know about the list at the moment they’re run.
 * @typedef {object} ListActionState
 * @property {InternalLocaleCode} locale Locale being edited.
 * @property {FieldKeyPath} keyPath Key path of the list.
 * @property {TypedFieldKeyPath} typedKeyPath Typed key path of the list.
 * @property {ComplexListField} fieldConfig List field configuration.
 * @property {boolean} pairedItems Whether the items are paired across the locales by position.
 */

/**
 * Actions of a List field, created with {@link createListActions}.
 * @typedef {object} ListActions
 * @property {number | undefined} addedItemIndex The index of the item being added.
 * @property {(stateMap: Record<string, boolean>) => void} updateExpanderStates Update the expander
 * states of the list and its items.
 * @property {() => void} initializeExpanderStates Initialize the expander states.
 * @property {(args?: ListItemAddArgs) => Promise<void> | undefined} addItem Add an item.
 * @property {(index: number) => Promise<void> | undefined} copyItem Copy an item to the clipboard.
 * @property {(index: number, options?: { replace?: boolean }) => Promise<void> | undefined
 * } pasteItem Paste a copied item.
 * @property {(index: number) => Promise<void> | undefined} removeItem Remove an item.
 * @property {(removedItem: RemovedListItem) => Promise<void> | undefined} restoreItem Restore a
 * removed item.
 * @property {(from: number, to: number) => void} moveItem Move an item to another position.
 */

/**
 * Arguments for adding an item to a List field.
 * @typedef {object} ListItemAddArgs
 * @property {number} [index] List index where a new item will be inserted.
 * @property {number} [dupIndex] List index of an item to be duplicated.
 * @property {string} [type] Variable type name. If the field doesn’t have variable types, it will
 * be `undefined`.
 * @property {Record<InternalLocaleCode, any>} [sourceItems] Pasted item in each locale.
 * @property {boolean} [replace] Whether to replace the item at the index with the new one.
 */

/**
 * Time to wait for a change to the list to be rendered, in milliseconds.
 */
export const LIST_RENDER_DELAY = 50;

/**
 * Create the actions of a List field with subfield(s): the changes made to the items, along with
 * the expander states and the focus that go with them. Use it in a component.
 * @param {object} args Arguments.
 * @param {EntryDraftState} args.entryDraft Entry draft state.
 * @param {string} args.fieldId ID of the field, which the IDs of its elements are based on.
 * @param {DraftValueStoreKey} args.valueStoreKey Key of the values in the draft.
 * @param {string} [args.componentName] Name of the rich text editor component the list is in, if
 * any.
 * @param {boolean} args.inEditorComponent Whether the list is in a rich text editor component.
 * @param {RemovedItemsState} args.removedItems State of the removed items.
 * @param {(type?: string) => ReturnType<typeof resolveVariableType>} args.resolveType Resolve the
 * type of an item.
 * @param {() => ListActionState} args.getListState Get the current state of the list.
 * @param {() => number} args.getItemCount Get the number of items in the list. Separate from the
 * state, as the items take assembling once they’ve changed, and few actions need the count.
 * @param {() => HTMLElement | undefined} args.getListElement Get the list element.
 * @param {() => HTMLElement | undefined} args.getTopToolbar Get the top toolbar element.
 * @returns {ListActions} Actions.
 */
export const createListActions = ({
  entryDraft,
  fieldId,
  valueStoreKey,
  componentName,
  inEditorComponent,
  removedItems,
  resolveType,
  getListState,
  getItemCount,
  getListElement,
  getTopToolbar,
}) => {
  /**
   * The index of the item being added, which is rendered right away rather than once it comes into
   * view, so it can be scrolled into view and focused at once.
   * @type {number | undefined}
   */
  let addedItemIndex = $state();
  /**
   * The item added last, which is followed until it stays in view.
   * @type {HTMLElement | undefined}
   */
  let latestAddedItem;

  /**
   * Wrap an action to run it with the draft. The controls are disabled once the draft is gone, so
   * the action is only left out in a race with the editor closing.
   * @template {any[]} A
   * @template R
   * @param {(draft: EntryDraft, ...args: A) => R} action Action.
   * @returns {(...args: A) => R | undefined} Wrapped action.
   */
  const withDraft =
    (action) =>
    (...args) => {
      const draft = entryDraft.current;

      return draft ? action(draft, ...args) : undefined;
    };

  /**
   * Update the items in every locale they’re changed in.
   * @param {EntryDraft} draft Entry draft.
   * @param {(arg: {
   * valueList: any[], expanderStateList: ExpanderStateList, locale: InternalLocaleCode
   * }) => void} manipulate See {@link updateListFieldForLocales}.
   */
  const updateItems = (draft, manipulate) => {
    const { locale, keyPath, fieldConfig, pairedItems } = getListState();

    updateListFieldForLocales({
      draft,
      locale,
      i18n: fieldConfig.i18n,
      pairedItems,
      valueStoreKey,
      keyPath,
      /**
       * Update the items in a locale, and remember the outcome for the removed items.
       * @param {Parameters<typeof manipulate>[0]} args Arguments.
       */
      manipulate: (args) => {
        manipulate(args);
        removedItems.remember(args.valueList, args.locale);
      },
    });
  };

  /**
   * Get the options the mutations of an existing item share. The items are tagged to tell whether
   * they’re replaced later. See `expectedListState` in the removed items state.
   * @returns {{ keyPath: FieldKeyPath, tagItems: boolean }} Options.
   */
  const getMutationOptions = () => {
    const { keyPath, fieldConfig } = getListState();

    return { keyPath, tagItems: !getListFieldInfo(fieldConfig).hasSingleSubField };
  };

  /**
   * Get the list item element at the specified index.
   * @param {number} index Target index.
   * @returns {HTMLElement | null | undefined} List item element.
   */
  const getItem = (index) =>
    /** @type {HTMLElement | null | undefined} */ (
      getListElement()?.children[index]?.querySelector('.item')
    );

  const updateExpanderStates = withDraft(
    /**
     * Update the expander states of the list and its items.
     * @param {EntryDraft} draft Entry draft.
     * @param {Record<string, boolean>} stateMap Map of key path and state.
     */
    (draft, stateMap) => {
      syncExpanderStates({ draft, stateMap });
    },
  );

  const initializeExpanderStates = withDraft(
    /**
     * Initialize the expander states of the list and its items.
     * @param {EntryDraft} draft Entry draft.
     */
    (draft) => {
      const { locale, keyPath, fieldConfig } = getListState();
      const { collapsed, minimize_collapsed: minimizeCollapsed = false } = fieldConfig;

      syncExpanderStates({
        draft,
        stateMap: getInitialListExpanderStates({
          draft,
          keyPath,
          itemCount: getItemCount(),
          locale,
          collapsed,
          minimizeCollapsed,
        }),
      });
    },
  );

  /**
   * Scroll a newly added item into view and move focus to it.
   * @param {number} index List index of the item.
   */
  const revealAddedItem = async (index) => {
    await sleep(LIST_RENDER_DELAY);
    addedItemIndex = undefined;

    const item = getItem(index);

    // The item is rendered right away, so this is only a race with the editor closing
    if (!item) {
      return;
    }

    // Leave room for the sticky toolbar, which sticks below the toolbars of the rich text editors
    // the field is in, if any, rather than scroll back for it, which shows as a bump
    const toolbarBottom = getStickyToolbarBottom(getTopToolbar());

    latestAddedItem = item;
    item.style.scrollMarginTop = `${toolbarBottom}px`;
    // Move focus to the expander button, without scrolling for it
    item.querySelector('button')?.focus({ preventScroll: true });
    await scrollToAddedListItem({
      item,
      list: /** @type {HTMLElement} */ (getListElement()),
      /**
       * Tell whether another item has been added since.
       * @returns {boolean} Result.
       */
      isOutdated: () => item !== latestAddedItem,
    });
  };

  const addItem = withDraft(
    /**
     * Add a new subfield to the list.
     * @param {EntryDraft} draft Entry draft.
     * @param {ListItemAddArgs} [args] Arguments.
     */
    async (draft, { index: targetIndex, dupIndex, type, sourceItems, replace = false } = {}) => {
      const { keyPath, fieldConfig } = getListState();
      const { hasSingleSubField } = getListFieldInfo(fieldConfig);
      const { add_to_top: addToTop = false } = fieldConfig;
      const { field } = /** @type {ListFieldWithSubField} */ (fieldConfig);
      const { types, typeKey = 'type' } = /** @type {ListFieldWithTypes} */ (fieldConfig);
      const index = targetIndex ?? (addToTop ? 0 : getItemCount());
      // Shared by the locales, so a duplicated unique value that is the same in each, like a UUID,
      // gets the same new one
      /** @type {Map<any, any>} */
      // eslint-disable-next-line svelte/prefer-svelte-reactivity
      const renewedValues = new Map();

      addedItemIndex = index;

      // A replaced item keeps its position, so the removed items shown around it stay where they
      // are
      if (!replace) {
        removedItems.shift(index);
      }

      updateItems(draft, ({ valueList, expanderStateList, locale: targetLocale }) => {
        const { subFields } = resolveType(type);

        const newItem = createListItem({
          valueList,
          keyPath,
          dupIndex,
          sourceItem: sourceItems?.[targetLocale],
          subFields,
          hasSingleSubField,
          field,
          type,
          types,
          typeKey,
          renewedValues,
          locale: targetLocale,
          defaultLocale: inEditorComponent ? targetLocale : draft.defaultLocale,
        });

        insertListItem({ valueList, expanderStateList }, { index, item: newItem, replace });
      });

      // Expand the parent if it is collapsed to show the newly added item
      syncExpanderStates({ draft, stateMap: { [`${keyPath}#`]: true } });

      await revealAddedItem(index);
    },
  );

  const copyItem = withDraft(
    /**
     * Copy an item to the clipboard, so it can be pasted into this list or another one that takes
     * it, in any entry.
     * @param {EntryDraft} draft Entry draft.
     * @param {number} index List index of the item.
     */
    async (draft, index) => {
      const { locale, keyPath, typedKeyPath, fieldConfig, pairedItems } = getListState();

      await copyListItem({
        draft,
        valueStoreKey,
        fieldConfig,
        keyPath,
        typedKeyPath,
        index,
        locale,
        pairedItems,
        componentName,
      });

      showListItemClipboardToast('success', _('list_item_copied'));
    },
  );

  const pasteItem = withDraft(
    /**
     * Paste a copied item into the list. The values that don’t fit the list are left out, and the
     * references to the files the item uses are rewritten for the entry.
     * @param {EntryDraft} draft Entry draft.
     * @param {number} index List index where the item will be inserted.
     * @param {object} [options] Options.
     * @param {boolean} [options.replace] Whether to replace the item at the index.
     */
    async (draft, index, { replace = false } = {}) => {
      const copied = await readListItem();

      if (!copied) {
        showListItemClipboardToast('info', _('no_list_item_to_paste'));

        return;
      }

      const { typedKeyPath, fieldConfig } = getListState();

      const result = await prepareListItemPaste({
        draft,
        valueStoreKey,
        copied,
        fieldConfig,
        typedKeyPath,
        componentName,
        inEditorComponent,
      });

      // Another entry may have been opened while the files were being copied
      if (entryDraft.current !== draft) {
        return;
      }

      if (!result) {
        showListItemClipboardToast('error', _('list_item_not_compatible'));

        return;
      }

      const { type, items: sourceItems, droppedCount, missingFileCount } = result;

      await addItem({ index, type, sourceItems, replace });

      const toast = getPastedItemToast({ droppedCount, missingFileCount });

      if (toast) {
        showListItemClipboardToast(toast.status, toast.message);
      }
    },
  );

  const removeItem = withDraft(
    /**
     * Remove a subfield.
     * @param {EntryDraft} draft Entry draft.
     * @param {number} index Target index.
     */
    async (draft, index) => {
      const options = getMutationOptions();
      const { keyPath } = options;
      const id = crypto.randomUUID();
      /** @type {RemovedListItem['values']} */
      const values = {};

      removedItems.add({
        id,
        index,
        values,
        expanded: isExpanded(draft, `${keyPath}.${index}`),
        nestedExpanderStates: getNestedExpanderStates(draft.expanderStates._, keyPath, index),
      });

      updateItems(draft, ({ valueList, expanderStateList, locale: targetLocale }) => {
        const value = removeListItem({ valueList, expanderStateList }, { ...options, index });

        // Keep the value, so the item can be restored
        if (value !== undefined) {
          values[targetLocale] = value;
        }
      });

      await sleep(LIST_RENDER_DELAY);
      // Move focus to the Restore button shown in place of the item, to restore it right away
      document.getElementById(`list-${fieldId}-restore-${id}`)?.focus();
    },
  );

  const restoreItem = withDraft(
    /**
     * Restore a removed item to the position it’s shown at.
     * @param {EntryDraft} draft Entry draft.
     * @param {RemovedListItem} removedItem Removed item.
     */
    async (draft, { id, index, values, expanded, nestedExpanderStates }) => {
      const options = getMutationOptions();
      const { keyPath } = options;

      removedItems.drop(id);

      updateItems(draft, ({ valueList, expanderStateList, locale: targetLocale }) => {
        if (targetLocale in values) {
          restoreListItem(
            { valueList, expanderStateList },
            { ...options, index, item: values[targetLocale], expanded },
          );
        }
      });

      // Put back the expander states of the objects and lists nested in the item
      syncExpanderStates({
        draft,
        stateMap: Object.fromEntries(
          nestedExpanderStates.map(([suffix, state]) => [`${keyPath}.${index}${suffix}`, state]),
        ),
      });

      await sleep(LIST_RENDER_DELAY);
      // Move focus to the expander button of the restored item
      getItem(index)?.querySelector('button')?.focus();
    },
  );

  const moveItem = withDraft(
    /**
     * Move a subfield to another position in the list.
     * @param {EntryDraft} draft Entry draft.
     * @param {number} from Source index.
     * @param {number} to Destination index.
     */
    (draft, from, to) => {
      const options = getMutationOptions();

      updateItems(draft, ({ valueList, expanderStateList }) => {
        moveListItem({ valueList, expanderStateList }, { ...options, from, to });
      });
    },
  );

  return {
    /**
     * The index of the item being added.
     * @returns {number | undefined} Index.
     */
    get addedItemIndex() {
      return addedItemIndex;
    },
    updateExpanderStates,
    initializeExpanderStates,
    addItem,
    copyItem,
    pasteItem,
    removeItem,
    restoreItem,
    moveItem,
  };
};
