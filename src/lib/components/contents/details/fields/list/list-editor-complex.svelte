<!--
  @component
  Implement the editor for a List field with subfield(s).
  @see https://decapcms.org/docs/widgets/#List
  @see https://decapcms.org/docs/variable-type-widgets/
  @see https://sveltiacms.app/en/docs/fields/list
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { VisibilityObserver } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { onMount } from 'svelte';
  import { flip } from 'svelte/animate';

  import RemoveButton from '$lib/components/common/remove-button.svelte';
  import ReorderControls from '$lib/components/common/reorder-controls.svelte';
  import CustomPreview from '$lib/components/contents/details/fields/custom/custom-preview.svelte';
  import ListItemMenu from '$lib/components/contents/details/fields/list/list-item-menu.svelte';
  import ListToolbar from '$lib/components/contents/details/fields/list/list-toolbar.svelte';
  import ObjectBody from '$lib/components/contents/details/fields/object/object-body.svelte';
  import ObjectHeader from '$lib/components/contents/details/fields/object/object-header.svelte';
  import RemovedItemNotice from '$lib/components/contents/details/fields/object/removed-item-notice.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { updateListFieldForLocales } from '$lib/services/contents/draft/update/list';
  import { getFieldValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import {
    getFieldEditorContext,
    isInEditorComponent,
  } from '$lib/services/contents/editor/field-context';
  import { isExpanded, syncExpanderStates } from '$lib/services/contents/editor/fields';
  import {
    getStickyToolbarBottom,
    scrollToAddedListItem,
  } from '$lib/services/contents/editor/scroll';
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
  } from '$lib/services/contents/fields/list/helpers';
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
  import { createRemovedItemsState } from '$lib/services/contents/fields/list/removed-items-state.svelte';
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
   * FieldEditorProps,
   * FlattenedEntryContent,
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

  const { valueStoreKey = 'currentValues', parentComponentNames = [] } = getFieldEditorContext();
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

      return /** @type {[string, boolean]} */ ([key, isExpanded(entryDraft.current, key)]);
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
  const showReorderControls = $derived(allowReorder && !singleItem);
  const isReorderDisabled = $derived(isLocked || items.length < 2);

  /* eslint-disable jsdoc/require-jsdoc */
  const removedItems = createRemovedItemsState({
    getLocale: () => locale,
    getItemKeys: () => itemKeys.current,
  });
  /* eslint-enable jsdoc/require-jsdoc */

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
      removedItems.shift(index);
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

      insertListItem({ valueList, expanderStateList }, { index, item: newItem, replace });
      removedItems.remember(valueList, targetLocale);
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
    const toolbarBottom = getStickyToolbarBottom(topToolbar);

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

    showListItemClipboardToast('success', _('list_item_copied'));
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
      showListItemClipboardToast('info', _('no_list_item_to_paste'));

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
      showListItemClipboardToast('error', _('list_item_not_compatible'));

      return;
    }

    const { type, items: sourceItems, droppedCount, missingFileCount } = result;

    await addItem({ index, type, sourceItems, replace });

    const toast = getPastedItemToast({ droppedCount, missingFileCount });

    if (toast) {
      showListItemClipboardToast(toast.status, toast.message);
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

    removedItems.add(removedItem);

    updateComplexList(({ valueList, expanderStateList, locale: targetLocale }) => {
      // The items are tagged to tell whether they’re replaced later. See `expectedListState`
      const value = removeListItem(
        { valueList, expanderStateList },
        { index, keyPath, tagItems: !hasSingleSubField },
      );

      // Keep the value, so the item can be restored
      if (value !== undefined) {
        values[targetLocale] = value;
      }

      removedItems.remember(valueList, targetLocale);
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
    removedItems.drop(id);

    updateComplexList(({ valueList, expanderStateList, locale: targetLocale }) => {
      if (!(targetLocale in values)) {
        return;
      }

      restoreListItem(
        { valueList, expanderStateList },
        { index, item: values[targetLocale], expanded, keyPath, tagItems: !hasSingleSubField },
      );
      removedItems.remember(valueList, targetLocale);
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
      moveListItem(
        { valueList, expanderStateList },
        { from, to, keyPath, tagItems: !hasSingleSubField },
      );
      removedItems.remember(valueList, targetLocale);
    });
  };

  /**
   * Get the values to summarize a list item with. Called from the item’s markup, this only depends
   * on the item’s own values, so typing in one item doesn’t make every collapsed item work out its
   * summary and thumbnail again; a summary only ever reads the values of its item.
   * @param {number} index List index.
   * @returns {FlattenedEntryContent} Entry values.
   */
  const getItemValueMap = (index) =>
    getFieldValueMapSnapshot(entryDraft.current, locale, `${keyPath}.${index}`, valueStoreKey);

  /**
   * Format the summary template.
   * @param {number} index List index.
   * @param {string} [summaryTemplate] Summary template, e.g. `{{fields.slug}}`.
   * @param {FlattenedEntryContent} [itemValueMap] Entry values to read the item’s values from.
   * Defaults to those of the whole list.
   * @returns {string} Formatted summary.
   */
  const _formatSummary = (index, summaryTemplate, itemValueMap = valueMap) =>
    formatSummary({
      collectionName,
      fileName,
      keyPath,
      valueMap: itemValueMap,
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
      valueMap: getItemValueMap(index),
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

  /** The props the top and bottom toolbars share. */
  const toolbarProps = $derived({
    fieldId,
    summaryId,
    fieldConfig,
    locale,
    items,
    fieldName,
    label,
    labelSingular,
    singleItem,
    parentExpanded,
    parentExpandedKeyPath,
    itemExpanderStates,
    allowAdd,
    addToTop,
    isAddDisabled,
    hasMaxItems,
    addItem,
    pasteItem,
    updateExpanderStates,
  });

  onMount(() => {
    initializeExpanderState();
    warnUnknownTypes();
  });
</script>

{#snippet removedItemNotices(/** @type {number} */ index)}
  {#each removedItems.byIndex.get(index) ?? [] as removedItem (removedItem.id)}
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
  <ListToolbar position="top" bind:element={topToolbar} {...toolbarProps} />
{/if}
<div
  role="none"
  id="list-{fieldId}-item-list"
  class="item-list"
  class:collapsed={!parentExpanded}
  bind:this={itemList}
  {...sorter.listProps}
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
        {@const reorderControlProps = sorter.reorderControlProps(index)}
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
            expandable={subFields.length > 0}
            toggleExpanded={() => updateExpanderStates({ [itemKeyPath]: !expanded })}
          >
            {#snippet centerContent()}
              {#if showReorderControls}
                <ReorderControls
                  {index}
                  itemCount={items.length}
                  disabled={isReorderDisabled}
                  icon="drag_handle"
                  part="handle"
                  {...reorderControlProps}
                />
              {/if}
            {/snippet}
            {#snippet endContent()}
              {#if showReorderControls}
                <ReorderControls
                  {index}
                  itemCount={items.length}
                  disabled={isReorderDisabled}
                  part="buttons"
                  menu={false}
                  onMove={reorderControlProps.onMove}
                />
              {/if}
              <ListItemMenu
                {index}
                {locale}
                variableTypes={hasVariableTypes ? variableTypes : undefined}
                {unknownType}
                {allowAdd}
                {allowRemove}
                {allowDuplicate}
                {hasMaxItems}
                {isAddDisabled}
                itemCount={items.length}
                canReorder={showReorderControls && !isLocked}
                moveItem={reorderControlProps.onMove}
                {copyItem}
                {pasteItem}
                {addItem}
              />
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
              getSummary={() => _formatSummary(index, summaryTemplate, getItemValueMap(index))}
              getThumbnail={() => getThumbnail(index, type)}
              summaryContent={customSummary ? customSummaryContent : undefined}
            />
          </div>
        </div>
      </VisibilityObserver>
    </div>
  {/each}
</div>
{#if removedItems.byIndex.has(items.length) && (parentExpanded || !items.length)}
  <!-- The items removed from the end of the list -->
  <div role="none" class="removed-item-list">
    {@render removedItemNotices(items.length)}
  </div>
{/if}
{#if allowAdd && !addToTop && items.length && parentExpanded && !hasMaxItems}
  <ListToolbar position="bottom" {...toolbarProps} />
{/if}

<style>
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
