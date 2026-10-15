<!--
  @component
  Implement the editor for a List field with subfield(s).
  @see https://decapcms.org/docs/widgets/#List
  @see https://decapcms.org/docs/variable-type-widgets/
  @see https://sveltiacms.app/en/docs/fields/list
-->
<script>
  import { _ } from '@sveltia/i18n';
  import {
    Button,
    Divider,
    Icon,
    Menu,
    MenuButton,
    MenuItem,
    Spacer,
    VisibilityObserver,
  } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import equal from 'fast-deep-equal';
  import { getContext, onMount } from 'svelte';
  import { flip } from 'svelte/animate';

  import ExpandIcon from '$lib/components/common/expand-icon.svelte';
  import RemoveButton from '$lib/components/common/remove-button.svelte';
  import ReorderControls from '$lib/components/common/reorder-controls.svelte';
  import CustomPreview from '$lib/components/contents/details/fields/custom/custom-preview.svelte';
  import AddItemButton from '$lib/components/contents/details/fields/object/add-item-button.svelte';
  import ObjectBody from '$lib/components/contents/details/fields/object/object-body.svelte';
  import ObjectHeader from '$lib/components/contents/details/fields/object/object-header.svelte';
  import RemovedItemNotice from '$lib/components/contents/details/fields/object/removed-item-notice.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { updateListFieldForLocales } from '$lib/services/contents/draft/update/list';
  import { getFieldValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { listItemClipboardToast } from '$lib/services/contents/editor';
  import { isInEditorComponent } from '$lib/services/contents/editor/field-context';
  import { isExpanded, syncExpanderStates } from '$lib/services/contents/editor/fields';
  import { scrollToAddedListItem } from '$lib/services/contents/editor/scroll';
  import { getMemoizedSubtree } from '$lib/services/contents/entry/subtree';
  import { getCustomFieldSummary } from '$lib/services/contents/fields/custom/preview';
  import {
    copyListItem,
    prepareListItemPaste,
    readListItem,
  } from '$lib/services/contents/fields/list/clipboard';
  import {
    formatSummary,
    getListFieldInfo,
    getListItemKey,
    isPairedList,
    isSingleItemList,
    tagListItems,
  } from '$lib/services/contents/fields/list/helpers';
  import {
    createListItem,
    getInitialListExpanderStates,
  } from '$lib/services/contents/fields/list/items';
  import {
    addRemovedItem,
    dropRestoredItem,
    getNestedExpanderStates,
    shiftRemovedItems,
  } from '$lib/services/contents/fields/list/removed-items';
  import {
    getTypedSubKeyPath,
    resolveVariableType,
    warnUnknownType,
  } from '$lib/services/contents/fields/object/helpers';
  import { getDraftObjectThumbnail } from '$lib/services/contents/fields/object/thumbnail';
  import { isFieldTranslatable } from '$lib/services/contents/i18n/fields';
  import { getFieldLabel, getLocalizedOption } from '$lib/services/contents/i18n/options';
  import { createDragSorter } from '$lib/services/utils/drag-sorting.svelte';
  import { createStableDerivedState } from '$lib/services/utils/state.svelte';

  /**
   * @import { SubtreeMemo } from '$lib/services/contents/entry/subtree';
   * @import {
   * ExpanderStateList,
   * FieldEditorContext,
   * FieldEditorProps,
   * InternalLocaleCode,
   * MediaFieldSource,
   * RemovedListItem,
   * } from '$lib/types/private';
   * @import {
   * ComplexListField,
   * CustomField,
   * CustomFieldSummary,
   * ListFieldWithSubField,
   * ListFieldWithSubFields,
   * ListFieldWithTypes,
   * } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ComplexListField} fieldConfig Field configuration.
   * @property {Record<string, any>[]} currentValue Field value.
   * @property {string} [summaryId] ID for the item count, which labels the list.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues', parentComponentNames = [] } =
    getContext('field-editor') ?? {};
  const componentName = parentComponentNames.at(-1);

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldConfig,
    required = true,
    readonly = false,
    summaryId,
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  const {
    name: fieldName,
    i18n,
    // Field type-specific options
    allow_add: allowAdd = true,
    allow_remove: allowRemove = true,
    allow_duplicate: allowDuplicate = true,
    allow_reorder: allowReorder = true,
    collapsed,
    summary,
    thumbnail: thumbnailFieldName,
    minimize_collapsed: minimizeCollapsed = false,
    max = Infinity,
    add_to_top: addToTop = false,
  } = $derived(/** @type {ComplexListField} */ (fieldConfig));
  const label = $derived(getLocalizedOption({ config: fieldConfig, option: 'label', locale }));
  const labelSingular = $derived(
    getLocalizedOption({ config: fieldConfig, option: 'label_singular', locale }),
  );
  const { field } = $derived(/** @type {ListFieldWithSubField} */ (fieldConfig));
  const { fields } = $derived(/** @type {ListFieldWithSubFields} */ (fieldConfig));
  const { types, typeKey = 'type' } = $derived(/** @type {ListFieldWithTypes} */ (fieldConfig));
  const { hasSingleSubField, hasVariableTypes } = $derived(getListFieldInfo(fieldConfig));
  /* v8 ignore start -- a list has either types, subfields or a single subfield */
  /** The types of a list with variable types. */
  const variableTypes = $derived(types ?? []);
  /** The subfields of an item in a list without variable types. */
  const singleSubFields = $derived(fields ?? (field ? [field] : []));
  /* v8 ignore stop */
  /** The summary component of the single subfield’s custom field type, if any. */
  const customSummary = $derived(hasSingleSubField ? getCustomFieldSummary(field) : undefined);

  /**
   * Resolve the type of an item, along with the subfields and the summary template for it.
   * @param {string | undefined} type Type name, if any.
   * @returns {ReturnType<typeof resolveVariableType>} Resolved type.
   */
  const resolveType = (type) =>
    resolveVariableType({
      types: hasVariableTypes ? variableTypes : undefined,
      fields: singleSubFields,
      summary,
      type,
    });

  /* v8 ignore start -- the editor is only rendered while the draft is there */
  const isIndexFile = $derived(!!entryDraft.current?.isIndexFile);
  const collectionName = $derived(entryDraft.current?.collectionName ?? '');
  /* v8 ignore stop */
  const fileName = $derived(entryDraft.current?.fileName);
  const defaultLocale = $derived(entryDraft.current?.defaultLocale);
  // A rich text editor component’s values live in the document of the locale they’re edited in,
  // so its items can be added in any locale, with the subfields getting their defaults there
  const inEditorComponent = isInEditorComponent(valueStoreKey);
  // The items of a translatable list with a duplicated subfield are paired across the locales by
  // their position, so they’re added, removed and moved in the default locale for every locale
  const pairedItems = $derived(!inEditorComponent && isPairedList(fieldConfig));
  // The items can’t be added, removed or reordered in a read-only field, which includes a field
  // duplicated from the default locale, whether with its own `duplicate` strategy or along with an
  // ancestor’s, in another locale. Changing them there would change the default locale as well. The
  // same goes for paired items, which would no longer line up with those of the default locale
  const isLocked = $derived(
    readonly || (locale !== defaultLocale && (i18n === 'duplicate' || pairedItems)),
  );
  const valueMap = $derived(
    getFieldValueMapSnapshot(entryDraft.current, locale, keyPath, valueStoreKey),
  );
  const parentExpandedKeyPath = $derived(`${keyPath}#`);
  /**
   * What the items were last assembled from, so they’re only assembled again once they’ve changed.
   * A plain object, as it’s only a memo.
   * @type {SubtreeMemo}
   */
  const itemsMemo = {};
  /** @type {Record<string, any>[]} */
  const items = $derived(getMemoizedSubtree(itemsMemo, valueMap, keyPath) ?? []);
  // A list limited to one item is shown like an Object field: no item count, list toggle or reorder
  // controls, and no way to remove the item if it’s required. A list with variable types keeps the
  // Remove button though, as that’s the only way to choose another type for the item
  const singleItem = $derived(isSingleItemList({ fieldConfig, itemCount: items.length }));
  const canRemoveItem = $derived(allowRemove && !(singleItem && required && !hasVariableTypes));
  // The single item can’t be collapsed along with the list, as there is no toggle to expand it
  const parentExpanded = $derived(
    singleItem || isExpanded(entryDraft.current, parentExpandedKeyPath),
  );
  const itemExpanderStates = $derived(
    items.map((_item, index) => {
      const key = `${keyPath}.${index}`;

      return [key, isExpanded(entryDraft.current, key)];
    }),
  );
  /**
   * The key of each item. The items are rebuilt whenever any of their values changes, e.g. on every
   * keystroke in an item, while the keys only change when an item is added, removed or moved.
   * Reading them through this keeps the keyed `each` block below from running again, which with its
   * `animate:` directive would measure the position of every item and force a layout each time.
   */
  const itemKeys = createStableDerivedState(() =>
    items.map((_item, index) => getListItemKey(items, index)),
  );
  const hasMaxItems = $derived(items.length >= max);
  /** The subfields of every item, regardless of its type. */
  const allSubFields = $derived(
    hasVariableTypes
      ? variableTypes.flatMap(({ fields: typeFields = [] }) => typeFields)
      : singleSubFields,
  );
  const hasEditableSubFields = $derived(
    locale === defaultLocale ||
      inEditorComponent ||
      allSubFields.some(({ i18n: subI18n }) => isFieldTranslatable(subI18n)),
  );
  const isAddDisabled = $derived(isLocked || !hasEditableSubFields);

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
  const shownRemovedItems = $derived(
    expectedListState?.locale === locale && equal(expectedListState.keys, itemKeys.current)
      ? removedItems
      : [],
  );
  /** The removed items grouped by the position they’re shown at. */
  const removedItemMap = $derived(Map.groupBy(shownRemovedItems, ({ index }) => index));

  /**
   * @type {HTMLElement | undefined}
   */
  let itemList = $state();
  /**
   * @type {HTMLElement | undefined}
   */
  let topToolbar = $state();
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
   * Show a notification once an item is copied or pasted.
   * @param {typeof listItemClipboardToast.current.status} status Status.
   * @param {string} message Message.
   */
  const showClipboardToast = (status, message) => {
    listItemClipboardToast.current = {
      id: listItemClipboardToast.current.id + 1,
      show: true,
      status,
      message,
    };
  };

  /**
   * Update the expander states of the list and its items.
   * @param {Record<string, boolean>} stateMap Map of key path and state.
   */
  const updateExpanderStates = (stateMap) => {
    // The controls are disabled once the draft is gone, so this is only a race with the editor
    // closing
    /* v8 ignore next 3 */
    if (!entryDraft.current) {
      return;
    }

    syncExpanderStates({ draft: entryDraft.current, stateMap });
  };

  /**
   * Initialize the expander state.
   */
  const initializeExpanderState = () => {
    const draft = entryDraft.current;

    // The editor is mounted with a draft; this is only a race with the editor closing
    /* v8 ignore next 3 */
    if (!draft) {
      return;
    }

    updateExpanderStates(
      getInitialListExpanderStates({
        draft,
        keyPath,
        itemCount: items.length,
        locale,
        collapsed,
        minimizeCollapsed,
      }),
    );
  };

  /**
   * Update the value for the List field with subfield(s).
   * @param {(arg: {
   * valueList: any[], expanderStateList: ExpanderStateList, locale: InternalLocaleCode
   * }) => void} manipulate See {@link updateListFieldForLocales}.
   */
  const updateComplexList = (manipulate) => {
    const draft = entryDraft.current;

    // The items are gone along with the draft, so this is only a race with the editor closing
    /* v8 ignore next 3 */
    if (!draft) {
      return;
    }

    updateListFieldForLocales({
      draft,
      locale,
      i18n,
      pairedItems,
      valueStoreKey,
      keyPath,
      manipulate,
    });
  };

  /**
   * Get the list item element at the specified index.
   * @param {number} index Target index.
   * @returns {HTMLElement | null | undefined} List item element.
   */
  const getItem = (index) =>
    /** @type {HTMLElement | null | undefined} */ (
      itemList?.children[index]?.querySelector('.item')
    );

  /**
   * Remember the item keys of the list in the locale being edited, once it’s been manipulated here.
   * See {@link expectedListState}.
   * @param {any[]} valueList Manipulated list.
   * @param {InternalLocaleCode} targetLocale Locale the list is for.
   */
  const rememberListState = (valueList, targetLocale) => {
    if (targetLocale === locale) {
      expectedListState = {
        locale,
        keys: valueList.map((_item, index) => getListItemKey(valueList, index)),
      };
    }
  };

  /**
   * Add a new subfield to the list.
   * @param {object} [args] Arguments.
   * @param {number} [args.index] List index where a new item will be inserted.
   * @param {number} [args.dupIndex] List index of an item to be duplicated.
   * @param {string} [args.type] Variable type name. If the field doesn’t have variable types, it
   * will be `undefined`.
   * @param {Record<InternalLocaleCode, any>} [args.sourceItems] Pasted item in each locale.
   * @param {boolean} [args.replace] Whether to replace the item at the index with the new one.
   */
  const addItem = async ({
    index = addToTop ? 0 : items.length,
    dupIndex,
    type,
    sourceItems,
    replace = false,
  } = {}) => {
    const draft = entryDraft.current;

    // The controls are disabled once the draft is gone, so this is only a race with the editor
    // closing
    /* v8 ignore next 3 */
    if (!draft) {
      return;
    }

    // Shared by the locales, so a duplicated UUID that is the same in each gets the same new one
    /** @type {Map<string, string>} */
    const renewedUuids = new Map();

    addedItemIndex = index;

    // A replaced item keeps its position, so the removed items shown around it stay where they are
    if (!replace) {
      removedItems = shiftRemovedItems(shownRemovedItems, index);
    }

    updateComplexList(({ valueList, expanderStateList, locale: targetLocale }) => {
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
        renewedUuids,
        locale: targetLocale,
        defaultLocale: inEditorComponent ? targetLocale : draft.defaultLocale,
      });

      valueList.splice(index, replace ? 1 : 0, newItem);
      expanderStateList.splice(index, replace ? 1 : 0, true);
      rememberListState(valueList, targetLocale);
    });

    // Expand the parent if it is collapsed to show the newly added item
    updateExpanderStates({ [parentExpandedKeyPath]: true });

    await sleep(50);
    addedItemIndex = undefined;

    const item = getItem(index);

    // The item is rendered right away, so this is only a race with the editor closing
    /* v8 ignore next 3 */
    if (!item) {
      return;
    }

    // Leave room for the sticky toolbar, which sticks below the toolbars of the rich text editors
    // the field is in, if any, rather than scroll back for it, which shows as a bump
    const toolbarBottom = topToolbar
      ? Number.parseFloat(getComputedStyle(topToolbar).top) +
        topToolbar.getBoundingClientRect().height
      : 0;

    latestAddedItem = item;
    item.style.scrollMarginTop = `${toolbarBottom}px`;
    // Move focus to the expander button, without scrolling for it
    item.querySelector('button')?.focus({ preventScroll: true });
    await scrollToAddedListItem({
      item,
      list: /** @type {HTMLElement} */ (itemList),
      /**
       * Tell whether another item has been added since.
       * @returns {boolean} Result.
       */
      isOutdated: () => item !== latestAddedItem,
    });
  };

  /**
   * Copy an item to the clipboard, so it can be pasted into this list or another one that takes it,
   * in any entry.
   * @param {number} index List index of the item.
   */
  const copyItem = async (index) => {
    const draft = entryDraft.current;

    // The menu is closed along with the editor, so this is only a race with the editor closing
    /* v8 ignore next 3 */
    if (!draft) {
      return;
    }

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

    showClipboardToast('success', _('list_item_copied'));
  };

  /**
   * Paste a copied item into the list. The values that don’t fit the list are left out, and the
   * references to the files the item uses are rewritten for the entry.
   * @param {number} index List index where the item will be inserted.
   * @param {object} [options] Options.
   * @param {boolean} [options.replace] Whether to replace the item at the index.
   */
  const pasteItem = async (index, { replace = false } = {}) => {
    const draft = entryDraft.current;

    // The controls are disabled once the draft is gone, so this is only a race with the editor
    // closing
    /* v8 ignore next 3 */
    if (!draft) {
      return;
    }

    const copied = await readListItem();

    if (!copied) {
      showClipboardToast('info', _('no_list_item_to_paste'));

      return;
    }

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
    /* v8 ignore next 3 */
    if (entryDraft.current !== draft) {
      return;
    }

    if (!result) {
      showClipboardToast('error', _('list_item_not_compatible'));

      return;
    }

    const { type, items: sourceItems, droppedCount, missingFileCount } = result;

    await addItem({ index, type, sourceItems, replace });

    if (missingFileCount) {
      showClipboardToast(
        'warning',
        _('list_item_pasted_without_files', { values: { count: missingFileCount } }),
      );
    } else if (droppedCount) {
      showClipboardToast(
        'info',
        _('list_item_pasted_without_values', { values: { count: droppedCount } }),
      );
    }
  };

  /**
   * Remove a subfield.
   * @param {number} index Target index.
   */
  const removeItem = async (index) => {
    const draft = entryDraft.current;

    // The controls are disabled once the draft is gone, so this is only a race with the editor
    // closing
    /* v8 ignore next 3 */
    if (!draft) {
      return;
    }

    const id = crypto.randomUUID();
    /** @type {RemovedListItem['values']} */
    const values = {};

    const removedItem = {
      id,
      index,
      values,
      expanded: isExpanded(draft, `${keyPath}.${index}`),
      nestedExpanderStates: getNestedExpanderStates(draft.expanderStates._, keyPath, index),
    };

    removedItems = addRemovedItem(shownRemovedItems, removedItem);

    updateComplexList(({ valueList, expanderStateList, locale: targetLocale }) => {
      if (!hasSingleSubField) {
        // Track original key paths for existing items before they shift due to the removal, and
        // give them an ID to tell whether they’re replaced later. See `expectedListState`
        tagListItems(valueList, keyPath, { assignIds: true });
      }

      const [value] = valueList.splice(index, 1);

      // Keep the value, so the item can be restored
      if (value !== undefined) {
        values[targetLocale] = value;
      }

      expanderStateList.splice(index, 1);
      rememberListState(valueList, targetLocale);
    });

    await sleep(50);
    // Move focus to the Restore button shown in place of the item, so it can be restored right away
    document.getElementById(`list-${fieldId}-restore-${id}`)?.focus();
  };

  /**
   * Restore a removed item to the position it’s shown at.
   * @param {RemovedListItem} removedItem Removed item.
   */
  const restoreItem = async ({ id, index, values, expanded, nestedExpanderStates }) => {
    removedItems = dropRestoredItem(shownRemovedItems, id);

    updateComplexList(({ valueList, expanderStateList, locale: targetLocale }) => {
      if (!(targetLocale in values)) {
        return;
      }

      if (!hasSingleSubField) {
        // Track original key paths for existing items before they shift due to the restoration
        tagListItems(valueList, keyPath);
      }

      valueList.splice(index, 0, values[targetLocale]);
      expanderStateList.splice(index, 0, expanded);
      rememberListState(valueList, targetLocale);
    });

    // Put back the expander states of the objects and lists nested in the item
    updateExpanderStates(
      Object.fromEntries(
        nestedExpanderStates.map(([suffix, state]) => [`${keyPath}.${index}${suffix}`, state]),
      ),
    );

    await sleep(50);
    // Move focus to the expander button of the restored item
    getItem(index)?.querySelector('button')?.focus();
  };

  /**
   * Move a subfield to another position in the list.
   * @param {number} from Source index.
   * @param {number} to Destination index.
   */
  const moveItem = (from, to) => {
    updateComplexList(({ valueList, expanderStateList, locale: targetLocale }) => {
      if (!hasSingleSubField) {
        // Ensure the IDs are unique before reordering, so that the `each` block below keeps
        // following each item rather than its position, and track original key paths for correct
        // revert after reordering
        tagListItems(valueList, keyPath, { assignIds: true });
      }

      valueList.splice(to, 0, ...valueList.splice(from, 1));
      // The expander states are only manipulated with the default locale, so this list may be empty
      expanderStateList.splice(to, 0, ...expanderStateList.splice(from, 1));
      rememberListState(valueList, targetLocale);
    });
  };

  /**
   * Format the summary template.
   * @param {number} index List index.
   * @param {string} [summaryTemplate] Summary template, e.g. `{{fields.slug}}`.
   * @returns {string} Formatted summary.
   */
  const _formatSummary = (index, summaryTemplate) =>
    formatSummary({
      collectionName,
      fileName,
      keyPath,
      valueMap,
      locale,
      summaryTemplate,
      hasSingleSubField,
      index,
      isIndexFile,
    });

  const sorter = createDragSorter({
    /**
     * Get the number of items in the list.
     * @returns {number} Item count.
     */
    getItemCount: () => items.length,
    /**
     * Get the list element.
     * @returns {HTMLElement | undefined} Element.
     */
    getListElement: () => itemList,
    onMove: moveItem,
    /**
     * Get the summary of an item, to be attached to its drag.
     * @param {number} index List index.
     * @returns {string} Summary.
     */
    getItemData: (index) =>
      _formatSummary(
        index,
        resolveType(hasVariableTypes ? items[index][typeKey] : undefined).summaryTemplate,
      ),
    /**
     * Wait for the moved item to be rendered in its new position.
     * @returns {Promise<void>} Promise.
     */
    settle: () => sleep(50),
    /**
     * Get the bounding rectangle of the item in a wrapper, leaving out the removed items shown
     * before it.
     * @param {HTMLElement} element Item wrapper.
     * @returns {DOMRect} Rectangle.
     */
    getItemRect: (element) =>
      /** @type {Element} */ (element.lastElementChild).getBoundingClientRect(),
  });

  /**
   * Get the thumbnail of a collapsed list item.
   * @param {number} index List index.
   * @param {string} [type] Variable type name of the item, if the list has variable types.
   * @returns {MediaFieldSource | undefined} Thumbnail.
   */
  const getThumbnail = (index, type) =>
    getDraftObjectThumbnail({
      draft: entryDraft.current,
      thumbnailFieldName,
      keyPath: `${keyPath}.${index}`,
      typedKeyPath: `${typedKeyPath}.*`,
      type,
      hasSingleSubField,
      componentName,
      valueMap,
      locale,
    });

  /**
   * Warn about unknown variable types used in the list items.
   */
  const warnUnknownTypes = () => {
    if (!hasVariableTypes) {
      return;
    }

    items.forEach((item, index) => {
      const type = item?.[typeKey];

      if (resolveType(type).unknownType) {
        warnUnknownType({
          fieldType: 'list',
          keyPath: `${keyPath}.${index}`,
          type,
          typeKey,
          types,
        });
      }
    });
  };

  onMount(() => {
    initializeExpanderState();
    warnUnknownTypes();
  });
</script>

{#snippet addPositionItems(/** @type {number} */ insertIndex, /** @type {string} */ position)}
  {#if hasVariableTypes}
    <MenuItem label={_(`add_item_${position}`)} disabled={isAddDisabled}>
      <!-- eslint-disable-next-line no-shadow -->
      {#snippet items()}
        {#each variableTypes as type (type.name)}
          <MenuItem
            label={getFieldLabel({ config: type, locale })}
            onclick={() => addItem({ index: insertIndex, type: type.name })}
          />
        {/each}
      {/snippet}
    </MenuItem>
  {:else}
    <MenuItem
      label={_(`add_item_${position}`)}
      disabled={isAddDisabled}
      onclick={() => addItem({ index: insertIndex })}
    />
  {/if}
{/snippet}

{#snippet pasteButton()}
  {#if !hasMaxItems}
    <Button
      variant="tertiary"
      size="small"
      iconic
      aria-label={_('paste_item')}
      disabled={isAddDisabled}
      onclick={() => pasteItem(addToTop ? 0 : items.length)}
    >
      {#snippet startIcon()}
        <Icon name="content_paste" />
      {/snippet}
    </Button>
  {/if}
{/snippet}

{#snippet removedItemNotices(/** @type {number} */ index)}
  {#each removedItemMap.get(index) ?? [] as removedItem (removedItem.id)}
    <RemovedItemNotice
      id="list-{fieldId}-restore-{removedItem.id}"
      disabled={isLocked || hasMaxItems}
      onRestore={() => restoreItem(removedItem)}
    />
  {/each}
{/snippet}

{#if singleItem}
  <!-- There is no item count to label the list with, so label it with the field name instead -->
  <div role="none" id={summaryId} hidden>{labelSingular || label || fieldName}</div>
{/if}
{#if !singleItem || !items.length}
  <div role="none" class="toolbar top" class:single={singleItem} bind:this={topToolbar}>
    {#if !singleItem}
      <div role="none" class="label">
        <Button
          iconic
          disabled={!items.length}
          aria-label={parentExpanded ? _('collapse') : _('expand')}
          aria-expanded={parentExpanded}
          aria-controls="list-{fieldId}-item-list"
          onclick={() => {
            updateExpanderStates({ [parentExpandedKeyPath]: !parentExpanded });
          }}
        >
          {#snippet startIcon()}
            <ExpandIcon expanded={parentExpanded} />
          {/snippet}
        </Button>
        <div role="none" class="summary" id={summaryId}>
          {items.length}
          {(items.length === 1 ? labelSingular : undefined) || label || fieldName}
        </div>
      </div>
    {/if}
    <div role="none" class="actions">
      {#if allowAdd && (addToTop || !items.length || !parentExpanded)}
        <AddItemButton disabled={isAddDisabled} {fieldConfig} {locale} {items} {addItem} />
        {@render pasteButton()}
      {/if}
      {#if parentExpanded && items.length > 1}
        {#each [true, false] as expanded (expanded)}
          <Button
            variant="tertiary"
            size="small"
            label={_(expanded ? 'expand_all' : 'collapse_all')}
            disabled={itemExpanderStates.every(([, value]) => value === expanded)}
            onclick={() => {
              updateExpanderStates(
                Object.fromEntries(itemExpanderStates.map(([key]) => [key, expanded])),
              );
            }}
          />
        {/each}
      {/if}
    </div>
  </div>
{/if}
<div
  role="none"
  id="list-{fieldId}-item-list"
  class="item-list"
  class:collapsed={!parentExpanded}
  bind:this={itemList}
  ondragovercapture={sorter.onDragOver}
  ondropcapture={sorter.onDrop}
>
  <!-- The display index is the position on screen, which follows a drag preview as well -->
  {#each sorter.displayOrder as index, displayIndex (itemKeys.current[index])}
    {@const item = items[index]}
    <!--
      The wrapper is what the `flip` animation moves: `animate:` only works on an element at the top
      level of a keyed `each` block, and the item itself sits inside `VisibilityObserver`.
    -->
    <div role="none" class="item-wrapper" animate:flip={{ duration: 200 }}>
      <!-- The items removed from this position are shown before the item now there -->
      {@render removedItemNotices(displayIndex)}
      <VisibilityObserver eager={index === addedItemIndex}>
        {@const itemKeyPath = `${keyPath}.${index}`}
        {@const type = hasVariableTypes ? item[typeKey] : undefined}
        {@const { typeConfig, unknownType, subFields, summaryTemplate } = resolveType(type)}
        {@const expanded = isExpanded(entryDraft.current, itemKeyPath)}
        <div
          role="group"
          aria-label={singleItem
            ? undefined
            : _('list_item_position', {
                values: { position: displayIndex + 1, count: items.length },
              })}
          class="item"
          class:unknown-type={unknownType}
          class:dragging={sorter.dragIndex === index}
          {...sorter.itemProps(index, {
            // A nested sortable list starts its own drag; the event just bubbles through here
            ownEventsOnly: true,
          })}
        >
          <ObjectHeader
            label={hasVariableTypes && typeConfig
              ? getFieldLabel({ config: typeConfig, locale })
              : ''}
            position={singleItem ? undefined : displayIndex + 1}
            controlId="list-{fieldId}-item-{index}-body"
            {expanded}
            toggleExpanded={subFields.length
              ? () => updateExpanderStates({ [itemKeyPath]: !expanded })
              : undefined}
          >
            {#snippet centerContent()}
              {#if allowReorder && !singleItem}
                <ReorderControls
                  {index}
                  itemCount={items.length}
                  disabled={isLocked || items.length < 2}
                  icon="drag_handle"
                  part="handle"
                  onGrab={() => sorter.grab(index)}
                  onRelease={sorter.release}
                  onMove={(to, action) => sorter.move(index, to, action)}
                />
              {/if}
            {/snippet}
            {#snippet endContent()}
              {#if allowReorder && !singleItem}
                <ReorderControls
                  {index}
                  itemCount={items.length}
                  disabled={isLocked || items.length < 2}
                  part="buttons"
                  onMove={(to, action) => sorter.move(index, to, action)}
                />
              {/if}
              <MenuButton
                variant="ghost"
                size="small"
                iconic
                popupPosition="bottom-right"
                aria-label={_('list_item_options')}
              >
                {#snippet popup()}
                  <Menu ariaLabel={_('list_item_options')}>
                    <!-- An item can be copied from a read-only list as well -->
                    <MenuItem
                      label={_('copy')}
                      disabled={unknownType}
                      onclick={() => copyItem(index)}
                    />
                    {#if allowAdd && allowRemove}
                      <!-- Replacing an item doesn’t change the number of items -->
                      <MenuItem
                        label={_('paste_item_to_replace')}
                        disabled={isAddDisabled}
                        onclick={() => pasteItem(index, { replace: true })}
                      />
                    {/if}
                    {#if allowAdd && !hasMaxItems}
                      <MenuItem
                        label={_('paste_item_above')}
                        disabled={isAddDisabled}
                        onclick={() => pasteItem(index)}
                      />
                      <MenuItem
                        label={_('paste_item_below')}
                        disabled={isAddDisabled}
                        onclick={() => pasteItem(index + 1)}
                      />
                      <Divider />
                      {#if allowDuplicate}
                        <MenuItem
                          label={_('duplicate')}
                          disabled={isAddDisabled || unknownType}
                          onclick={() => addItem({ index: index + 1, dupIndex: index })}
                        />
                      {/if}
                      {@render addPositionItems(index, 'above')}
                      {@render addPositionItems(index + 1, 'below')}
                    {/if}
                  </Menu>
                {/snippet}
              </MenuButton>
              {#if canRemoveItem}
                <RemoveButton
                  variant="ghost"
                  disabled={isLocked}
                  onclick={() => removeItem(index)}
                />
              {/if}
            {/snippet}
          </ObjectHeader>
          <div role="none" class="item-body" id="list-{fieldId}-item-{index}-body">
            {#snippet customSummaryContent()}
              <CustomPreview
                {locale}
                keyPath={itemKeyPath}
                typedKeyPath="{typedKeyPath}.*"
                currentValue={item}
                {...{
                  fieldConfig: /** @type {CustomField} */ (field),
                  preview: /** @type {CustomFieldSummary} */ (customSummary),
                }}
              />
            {/snippet}
            <ObjectBody
              {locale}
              {subFields}
              getSubFieldProps={(subField) => ({
                keyPath: hasSingleSubField ? itemKeyPath : `${itemKeyPath}.${subField.name}`,
                typedKeyPath: getTypedSubKeyPath({
                  typedKeyPath: `${typedKeyPath}.*`,
                  type,
                  subFieldName: subField.name,
                }),
                context: hasSingleSubField ? 'single-subfield-list-field' : undefined,
              })}
              {expanded}
              {unknownType}
              hint={readonly || !typeConfig
                ? undefined
                : getLocalizedOption({ config: typeConfig, option: 'hint', locale })}
              getSummary={() => _formatSummary(index, summaryTemplate)}
              getThumbnail={() => getThumbnail(index, type)}
              summaryContent={customSummary ? customSummaryContent : undefined}
            />
          </div>
        </div>
      </VisibilityObserver>
    </div>
  {/each}
</div>
{#if removedItemMap.has(items.length) && (parentExpanded || !items.length)}
  <!-- The items removed from the end of the list -->
  <div role="none" class="removed-item-list">
    {@render removedItemNotices(items.length)}
  </div>
{/if}
{#if allowAdd && !addToTop && items.length && parentExpanded && !hasMaxItems}
  <div role="none" class="toolbar bottom add">
    <Spacer flex />
    <AddItemButton disabled={isAddDisabled} {fieldConfig} {locale} {items} {addItem} />
    {@render pasteButton()}
  </div>
{/if}

<style>
  .toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0 8px;
    position: sticky;
    z-index: 10;
    background-color: var(--sui-primary-background-color);
    min-height: var(--sui-secondary-toolbar-size);

    &.top {
      /* Below the sticky toolbars of the rich text editors the field is in, if any */
      top: var(--sui-text-editor-inner-toolbar-top, 0);
    }

    &.bottom {
      bottom: 0;
    }

    & > div {
      display: flex;
      align-items: center;

      &.actions {
        flex-wrap: wrap;
        margin-block: 8px;
        margin-inline-start: auto;
      }
    }

    &.single > div.actions {
      /* With no item count on the left, the Add button goes where the item would be */
      margin-inline-start: 0;
    }
  }

  .item-list {
    display: flex;
    flex-direction: column;
    gap: 16px;

    &.collapsed {
      display: none;
    }
  }

  .item-wrapper,
  .removed-item-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .removed-item-list {
    margin-block-start: 16px;
  }

  .item {
    flex: none;
    position: relative;
    border-width: 2px;
    border-color: var(--sui-secondary-border-color);
    border-radius: var(--sui-control-medium-border-radius);
    background-color: var(--sui-primary-background-color); /* for dragging opacity */

    &.unknown-type {
      overflow: hidden;

      :global(.alert) {
        border-width: 0;
        border-radius: 0;
      }
    }

    /* The dragged item is left as a faint placeholder marking the gap it would drop into. The
      pointer already carries the browser’s own drag image of it, so showing it twice at full
      strength would just be confusing. */

    &.dragging {
      opacity: 0.25;
    }

    /* Like the field menus, the buttons at the end of the header (Move Up/Down, options and
      remove) are shown on hover, and kept visible while a keyboard user is in the item, so the
      focused one isn’t invisible, or while the options menu is open */
    @media (hover: hover) {
      &:not(:hover, :focus-within) > :global(.header > .end button:not([aria-expanded='true'])) {
        opacity: 0;
      }
    }
  }
</style>
