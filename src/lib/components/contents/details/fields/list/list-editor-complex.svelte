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
  import { getFieldValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import {
    getFieldEditorContext,
    isInEditorComponent,
  } from '$lib/services/contents/editor/field-context';
  import { isExpanded } from '$lib/services/contents/editor/fields';
  import { getMemoizedSubtree } from '$lib/services/contents/entry/subtree';
  import { getCustomFieldSummary } from '$lib/services/contents/fields/custom/preview';
  import {
    createListActions,
    LIST_RENDER_DELAY,
  } from '$lib/services/contents/fields/list/actions.svelte';
  import {
    formatSummary,
    getListFieldInfo,
    getListItemKey,
    isPairedList,
    isSingleItemList,
  } from '$lib/services/contents/fields/list/helpers';
  import { createRemovedItemsState } from '$lib/services/contents/fields/list/removed-items-state.svelte';
  import {
    getTypedSubKeyPath,
    resolveVariableType,
    warnUnknownType,
  } from '$lib/services/contents/fields/object/helpers';
  import { getDraftObjectThumbnail } from '$lib/services/contents/fields/object/thumbnail';
  import { isFieldTranslatable } from '$lib/services/contents/i18n/fields';
  import { getFieldLabel, getLocalizedOption } from '$lib/services/contents/i18n/options';
  import { isSyncedField } from '$lib/services/contents/i18n/shared-values';
  import { createDragSorter } from '$lib/services/utils/drag-sorting.svelte';
  import { createStableDerivedState } from '$lib/services/utils/state.svelte';

  /**
   * @import { SubtreeMemo } from '$lib/services/contents/entry/subtree';
   * @import {
   * FieldEditorProps,
   * FlattenedEntryContent,
   * MediaFieldSource,
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
    locale,
    keyPath,
    typedKeyPath,
    fieldConfig,
    required = true,
    readonly = false,
    summaryId,
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
    summary,
    thumbnail: thumbnailFieldName,
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
  // A list using the `sync` i18n strategy, with its own option or along with an ancestor, is kept
  // the same in every locale while it can be edited in any of them, subfields included
  const synced = $derived(
    !inEditorComponent &&
      locale !== defaultLocale &&
      isSyncedField({
        fieldConfig,
        getFieldArgs: { collectionName, fileName, isIndexFile, keyPath, valueMap },
      }),
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
      synced ||
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
  /* eslint-disable jsdoc/require-jsdoc */
  const listActions = createListActions({
    entryDraft,
    fieldId,
    valueStoreKey,
    componentName,
    inEditorComponent,
    removedItems,
    resolveType,
    getListState: () => ({
      locale,
      keyPath,
      typedKeyPath,
      fieldConfig,
      pairedItems,
    }),
    getItemCount: () => items.length,
    getListElement: () => itemList,
    getTopToolbar: () => topToolbar,
  });
  /* eslint-enable jsdoc/require-jsdoc */

  const {
    updateExpanderStates,
    initializeExpanderStates,
    addItem,
    copyItem,
    pasteItem,
    removeItem,
    restoreItem,
    moveItem,
  } = listActions;

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
    settle: () => sleep(LIST_RENDER_DELAY),
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
    initializeExpanderStates();
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
      <VisibilityObserver eager={index === listActions.addedItemIndex}>
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
          class:object-unknown-type={unknownType}
          class:drag-placeholder={sorter.dragIndex === index}
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
              {typeConfig}
              {readonly}
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
