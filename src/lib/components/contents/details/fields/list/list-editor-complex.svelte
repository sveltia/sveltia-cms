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
    Alert,
    Button,
    Icon,
    Menu,
    MenuButton,
    MenuItem,
    Spacer,
    TruncatedText,
    VisibilityObserver,
  } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { isObject } from '@sveltia/utils/object';
  import { escapeRegExp } from '@sveltia/utils/string';
  import { unflatten } from 'flat';
  import { getContext, onMount, untrack } from 'svelte';
  import { flip } from 'svelte/animate';

  import Image from '$lib/components/assets/shared/image.svelte';
  import ExpandIcon from '$lib/components/common/expand-icon.svelte';
  import ReorderControls from '$lib/components/common/reorder-controls.svelte';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import AddItemButton from '$lib/components/contents/details/fields/object/add-item-button.svelte';
  import ObjectHeader from '$lib/components/contents/details/fields/object/object-header.svelte';
  import { getMediaFieldURL } from '$lib/services/assets/info';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getDefaultValues } from '$lib/services/contents/draft/defaults';
  import { updateListField } from '$lib/services/contents/draft/update/list';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import {
    getInitialExpanderState,
    syncExpanderStates,
  } from '$lib/services/contents/editor/fields';
  import { getField } from '$lib/services/contents/entry/fields';
  import { formatSummary, getListFieldInfo } from '$lib/services/contents/fields/list/helpers';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
  import { env } from '$lib/services/user/env.svelte';
  import {
    getDropIndex,
    getListItemAt,
    getMoveTarget,
    moveListItem,
    startAutoScroll,
    stopAutoScroll,
  } from '$lib/services/utils/drag-sorting';
  import { unflattenMap } from '$lib/services/utils/object';

  /**
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import {
   * ComplexListField,
   * FieldKeyPath,
   * ListFieldWithSubField,
   * ListFieldWithSubFields,
   * ListFieldWithTypes,
   * } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ComplexListField} fieldConfig Field configuration.
   * @property {Record<string, any>[]} currentValue Field value.
   */

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
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  const {
    name: fieldName,
    label,
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
    label_singular: labelSingular,
    max = Infinity,
    add_to_top: addToTop = false,
  } = $derived(/** @type {ComplexListField} */ (fieldConfig));
  const { field } = $derived(/** @type {ListFieldWithSubField} */ (fieldConfig));
  const { fields } = $derived(/** @type {ListFieldWithSubFields} */ (fieldConfig));
  const { types, typeKey = 'type' } = $derived(/** @type {ListFieldWithTypes} */ (fieldConfig));
  const { hasSingleSubField, hasVariableTypes } = $derived(getListFieldInfo(fieldConfig));
  const keyPathRegex = $derived(new RegExp(`^${escapeRegExp(keyPath)}\\.(\\d+)(.*)?`));
  const isIndexFile = $derived($entryDraft?.isIndexFile ?? false);
  const collection = $derived($entryDraft?.collection);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const collectionFile = $derived($entryDraft?.collectionFile);
  const fileName = $derived($entryDraft?.fileName);
  const { defaultLocale } = $derived((collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG);
  const isDuplicateField = $derived(locale !== defaultLocale && i18n === 'duplicate');
  const valueMap = $derived(getValueMapSnapshot($entryDraft, locale, valueStoreKey));
  const parentExpandedKeyPath = $derived(`${keyPath}#`);
  const parentExpanded = $derived($entryDraft?.expanderStates?._[parentExpandedKeyPath] ?? true);
  /** @type {Record<string, any>[]} */
  const items = $derived(
    unflattenMap(
      Object.fromEntries(
        Object.entries(valueMap)
          .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
          .map(([_keyPath, value]) => [`${fieldName}${_keyPath.slice(keyPath.length)}`, value]),
      ),
    )[fieldName] ?? [],
  );
  const itemExpanderStates = $derived(
    items.map((_item, index) => {
      const key = `${keyPath}.${index}`;

      return [key, $entryDraft?.expanderStates?._[key] ?? true];
    }),
  );
  const hasMaxItems = $derived(items.length >= max);
  const hasEditableSubFields = $derived(
    locale === defaultLocale ||
      (hasVariableTypes
        ? (types?.flatMap(({ fields: typeFields = [] }) => typeFields) ?? [])
        : (fields ?? (field ? [field] : []))
      ).some(({ i18n: subI18n = false }) => subI18n === true || subI18n === 'translate'),
  );
  const isAddDisabled = $derived(isDuplicateField || !hasEditableSubFields);

  /**
   * List item thumbnails.
   * @type {(string | undefined)[]}
   */
  const thumbnails = $state([]);
  /**
   * @type {HTMLElement | undefined}
   */
  let itemList = $state();
  /**
   * Index of the item made draggable by a press on its drag handle. Only the handle starts a drag,
   * so the rest of the item stays selectable and its own controls keep working.
   * @type {number | undefined}
   */
  let grabbedIndex = $state();
  /**
   * Index of the item currently being dragged.
   * @type {number | undefined}
   */
  let dragIndex = $state();
  /**
   * Item indexes in the order they are displayed. While an item is being dragged, this holds the
   * provisional order, so the other items slide out of the way and the gap the dragged item would
   * land in follows the pointer. `undefined` while no drag is in progress.
   * @type {number[] | undefined}
   */
  let previewOrder = $state();

  /**
   * The order the items are rendered in. This is the identity order except during a drag. A stale
   * preview left over from a list that changed length underneath is discarded.
   * @type {number[]}
   */
  const displayOrder = $derived(
    previewOrder?.length === items.length ? previewOrder : items.map((_item, index) => index),
  );

  /**
   * Initialize the expander state.
   */
  const initializeExpanderState = () => {
    syncExpanderStates({
      [parentExpandedKeyPath]: minimizeCollapsed === 'auto' ? !items.length : !minimizeCollapsed,
      ...Object.fromEntries(
        items.map((__, index) => {
          const key = `${keyPath}.${index}`;

          return [key, getInitialExpanderState({ key, locale, collapsed })];
        }),
      ),
    });
  };

  /**
   * Update the value for the List field with subfield(s).
   * @param {(arg: { valueList: any[], expanderStateList: boolean[] }) => void} manipulate
   * See {@link updateListField}.
   */
  const updateComplexList = (manipulate) => {
    Object.keys($entryDraft?.[valueStoreKey] ?? {}).forEach((_locale) => {
      if (!(i18n !== 'duplicate' && _locale !== locale)) {
        updateListField({ locale: _locale, valueStoreKey, keyPath, manipulate });
      }
    });
  };

  /**
   * Get the list item element at the specified index.
   * @param {number} index Target index.
   * @returns {HTMLElement | undefined} List item element.
   */
  const getItem = (index) => /** @type {HTMLElement} */ (itemList?.children[index]);

  /**
   * Get the `each` block key that identifies the item at the given index. Object items carry a
   * generated ID that follows the item as the list is reordered; primitives can only be keyed by
   * their position.
   * @param {number} index Target index.
   * @returns {string | number} Key.
   */
  const getItemKey = (index) => {
    const item = items[index];

    return isObject(item) ? (item.__sc_item_id ?? index) : index;
  };

  /**
   * Add a new subfield to the list.
   * @param {object} [args] Arguments.
   * @param {number} [args.index] List index where a new item will be inserted.
   * @param {number} [args.dupIndex] List index of an item to be duplicated.
   * @param {string} [args.type] Variable type name. If the field doesn’t have variable types, it
   * will be `undefined`.
   */
  const addItem = async ({ index = addToTop ? 0 : items.length, dupIndex, type } = {}) => {
    updateComplexList(({ valueList, expanderStateList }) => {
      const subFields = type
        ? (types?.find(({ name }) => name === type)?.fields ?? [])
        : (fields ?? (field ? [field] : []));

      const newItem = (() => {
        if (typeof dupIndex === 'number') {
          return structuredClone(valueList[dupIndex]);
        }

        const item = unflatten(getDefaultValues({ fields: subFields, locale, defaultLocale }));

        return hasSingleSubField && field ? item[field.name] : item;
      })();

      if (type) {
        newItem[typeKey] = type;
      }

      if (!hasSingleSubField) {
        // Add a random ID to the new item to ensure it is unique. This is necessary for the `key`
        // attribute in the `each` block.
        newItem.__sc_item_id = crypto.randomUUID();

        // Track original key paths for existing items before they shift due to the insertion
        valueList.forEach((item, i) => {
          if (isObject(item)) {
            item.__sc_item_original_key_path ??= `${keyPath}.${i}`;
          }
        });
      }

      valueList.splice(index, 0, newItem);
      expanderStateList.splice(index, 0, true);
    });

    // Expand the parent if it is collapsed to show the newly added item
    syncExpanderStates({ [parentExpandedKeyPath]: true });

    await sleep(50);
    // Move the placeholder into view
    getItem(index)?.scrollIntoView();
    // Wait until the placeholder is replaced with the actual content
    await sleep(100);
    // Scroll again for the sticky toolbar
    itemList?.closest('.content')?.scrollBy({ top: -50, behavior: 'instant' });
    // Move focus to the expander button
    getItem(index)?.querySelector('button')?.focus();
  };

  /**
   * Remove a subfield.
   * @param {number} index Target index.
   */
  const removeItem = async (index) => {
    updateComplexList(({ valueList, expanderStateList }) => {
      if (!hasSingleSubField) {
        // Track original key paths for existing items before they shift due to the removal
        valueList.forEach((item, i) => {
          if (isObject(item)) {
            item.__sc_item_original_key_path ??= `${keyPath}.${i}`;
          }
        });
      }

      valueList.splice(index, 1);
      expanderStateList.splice(index, 1);
    });

    await sleep(50);
    (getItem(index) ?? itemList?.closest('[role="group"]')?.querySelector('button'))?.focus();
  };

  /**
   * Move a subfield to another position in the list.
   * @param {number} from Source index.
   * @param {number} to Destination index.
   * @param {string} [action] `data-action` of the reorder control that triggered the move, so the
   * focus can be restored to the matching control on the item once it has moved.
   */
  const moveItem = async (from, to, action = 'reorder') => {
    updateComplexList(({ valueList, expanderStateList }) => {
      if (!hasSingleSubField) {
        valueList.forEach((item, index) => {
          if (isObject(item)) {
            // Ensure the IDs are unique before reordering, so that the `each` block below keeps
            // following each item rather than its position
            item.__sc_item_id ??= crypto.randomUUID();
            // Track original key paths for correct revert after reordering
            item.__sc_item_original_key_path ??= `${keyPath}.${index}`;
          }
        });
      }

      valueList.splice(to, 0, ...valueList.splice(from, 1));
      // The expander states are only manipulated with the default locale, so this list may be empty
      expanderStateList.splice(to, 0, ...expanderStateList.splice(from, 1));
    });

    await sleep(50);
    // Move the focus back to the control on the item that was just moved, so that it can be used
    // repeatedly without having to find it again
    /** @type {HTMLElement | null | undefined} */ (
      getItem(to)?.querySelector(`button[data-action="${action}"]`)
    )?.focus();
  };

  /**
   * Handle a `dragover` event fired while an item is being reordered.
   *
   * The list-level drag handlers run in the capture phase, so that a drop zone or another sortable
   * list nested in an item — a File subfield, say — never sees a reorder drag and doesn’t light up
   * as a drop target. Anything else being dragged, such as a file from the desktop, is passed
   * through untouched.
   * @param {DragEvent} event `dragover` event.
   */
  const onDragOver = (event) => {
    if (dragIndex === undefined || !previewOrder) {
      return;
    }

    event.stopPropagation();
    // The browser rejects the drop and never fires the `drop` event unless the default is prevented
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const item = getListItemAt({ target: event.target, listElement: itemList });

    // Keep the current order while the pointer is over a gap between two items
    if (!item) {
      return;
    }

    const from = previewOrder.indexOf(dragIndex);

    const to = getMoveTarget({
      dragIndex: from,
      dropIndex: getDropIndex({
        index: item.index,
        clientY: event.clientY,
        rect: item.element.getBoundingClientRect(),
      }),
    });

    if (to !== undefined) {
      previewOrder = moveListItem(previewOrder, from, to);
    }
  };

  /**
   * Handle a `drop` event fired while an item is being reordered.
   * @param {DragEvent} event `drop` event.
   */
  const onDrop = (event) => {
    if (dragIndex === undefined) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    stopAutoScroll();

    const from = dragIndex;
    // Where the item ended up in the preview is where it should be committed
    const to = previewOrder?.indexOf(dragIndex) ?? from;

    grabbedIndex = undefined;
    dragIndex = undefined;
    // The committed order matches the preview, so the items don’t move again on the way out
    previewOrder = undefined;

    if (to !== from) {
      moveItem(from, to);
    }
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

  /**
   * Get the thumbnail image URL for a list item.
   * @param {number} index List index.
   * @returns {Promise<string | undefined>} Thumbnail image URL.
   */
  const getThumbnail = async (index) => {
    if (!thumbnailFieldName) {
      return undefined;
    }

    const fieldNameNormalized = thumbnailFieldName.replace(/^fields\./, '');
    const itemKeyPath = `${keyPath}.${index}`;

    // For single-subfield lists (`field:` option), values are stored at the item key path directly
    // (without the field name). `getField(itemKeyPath)` already traverses into the subfield, so we
    // use it to validate the name match too.
    const thumbnailKeyPath = hasSingleSubField
      ? itemKeyPath
      : `${itemKeyPath}.${fieldNameNormalized}`;

    const thumbnailValue = valueMap[thumbnailKeyPath];

    if (!thumbnailValue) {
      return undefined;
    }

    const thumbnailFieldConfig = getField({
      collectionName,
      fileName,
      valueMap,
      keyPath: thumbnailKeyPath,
      isIndexFile,
    });

    if (
      thumbnailFieldConfig?.widget !== 'image' ||
      (hasSingleSubField && thumbnailFieldConfig.name !== fieldNameNormalized)
    ) {
      return undefined;
    }

    return getMediaFieldURL({
      value: thumbnailValue,
      entry: $entryDraft?.originalEntry,
      collectionName,
      fileName,
      componentName,
      typedKeyPath: hasSingleSubField
        ? `${typedKeyPath}.*`
        : `${typedKeyPath}.*.${fieldNameNormalized}`,
    });
  };

  /**
   * Update thumbnails for all items.
   */
  const updateThumbnails = async () => {
    if (!thumbnailFieldName) {
      return;
    }

    thumbnails.length = items.length;

    items.forEach(async (_item, index) => {
      const itemThumbnail = await getThumbnail(index);

      if (thumbnails[index] !== itemThumbnail) {
        thumbnails[index] = itemThumbnail;
      }
    });
  };

  /**
   * Warn about unknown variable type.
   * @param {object} args Arguments.
   * @param {FieldKeyPath} args.itemKeyPath Item’s key path.
   * @param {string} args.type Item’s type.
   */
  const warnUnknownType = ({ itemKeyPath, type }) => {
    const message = type
      ? `The “${type}” type is not defined for the list field.`
      : `The type key is not found in the list item. The item must include the “${typeKey}” ` +
        `property with one of the defined types: ${types.map((t) => t.name).join(', ')}`;

    // eslint-disable-next-line no-console
    console.warn(`List item ${itemKeyPath}: ${message}`);
  };

  $effect(() => {
    void [items];

    untrack(() => {
      updateThumbnails();
    });
  });

  onMount(() => {
    initializeExpanderState();
  });
</script>

{#snippet addPositionItems(/** @type {number} */ insertIndex, /** @type {string} */ position)}
  {#if hasVariableTypes}
    <MenuItem label={_(`add_item_${position}`)} disabled={hasMaxItems}>
      <!-- eslint-disable-next-line no-shadow -->
      {#snippet items()}
        {#each types ?? [] as { name, label: itemLabel } (name)}
          <MenuItem
            label={itemLabel || name}
            onclick={() => addItem({ index: insertIndex, type: name })}
          />
        {/each}
      {/snippet}
    </MenuItem>
  {:else}
    <MenuItem
      label={_(`add_item_${position}`)}
      disabled={hasMaxItems}
      onclick={() => addItem({ index: insertIndex })}
    />
  {/if}
{/snippet}

<div role="none" class="toolbar top">
  <div role="none" class="label">
    <Button
      iconic
      disabled={!items.length}
      aria-label={parentExpanded ? _('collapse') : _('expand')}
      aria-expanded={parentExpanded}
      aria-controls="list-{fieldId}-item-list"
      onclick={() => {
        syncExpanderStates({ [parentExpandedKeyPath]: !parentExpanded });
      }}
    >
      {#snippet startIcon()}
        <ExpandIcon expanded={parentExpanded} />
      {/snippet}
    </Button>
    <div role="none" class="summary" id="object-{fieldId}-summary">
      {items.length}
      {(items.length === 1 ? labelSingular : undefined) || label || fieldName}
    </div>
  </div>
  <div role="none" class="actions">
    {#if allowAdd && (addToTop || !items.length || !parentExpanded)}
      <AddItemButton disabled={isAddDisabled} {fieldConfig} {items} {addItem} />
    {/if}
    {#if parentExpanded && items.length > 1}
      <Button
        variant="tertiary"
        size="small"
        label={_('expand_all')}
        disabled={itemExpanderStates.every(([, value]) => value)}
        onclick={() => {
          syncExpanderStates(Object.fromEntries(itemExpanderStates.map(([key]) => [key, true])));
        }}
      />
      <Button
        variant="tertiary"
        size="small"
        label={_('collapse_all')}
        disabled={itemExpanderStates.every(([, value]) => !value)}
        onclick={() => {
          syncExpanderStates(Object.fromEntries(itemExpanderStates.map(([key]) => [key, false])));
        }}
      />
    {/if}
  </div>
</div>
<div
  role="none"
  id="list-{fieldId}-item-list"
  class="item-list"
  class:collapsed={!parentExpanded}
  bind:this={itemList}
  ondragovercapture={onDragOver}
  ondropcapture={onDrop}
>
  {#each displayOrder as index (getItemKey(index))}
    {@const item = items[index]}
    <!--
      The wrapper is what the `flip` animation moves: `animate:` only works on an element at the top
      level of a keyed `each` block, and the item itself sits inside `VisibilityObserver`.
    -->
    <div role="none" class="item-wrapper" animate:flip={{ duration: 200 }}>
      <VisibilityObserver>
        {@const itemKeyPath = `${keyPath}.${index}`}
        {@const type = hasVariableTypes ? item[typeKey] : undefined}
        {@const typeConfig = type ? types?.find(({ name }) => name === type) : undefined}
        {#if hasVariableTypes && !typeConfig}
          <Alert status="warning">{_('unknown_variable_type')}</Alert>
          {warnUnknownType({ itemKeyPath, type })}
        {:else}
          {@const expanded = $entryDraft?.expanderStates?._[itemKeyPath] ?? true}
          {@const subFields = hasVariableTypes
            ? (typeConfig?.fields ?? [])
            : (fields ?? (field ? [field] : []))}
          {@const summaryTemplate = hasVariableTypes ? typeConfig?.summary || summary : summary}
          <div
            role="group"
            class="item"
            class:dragging={dragIndex === index}
            draggable={grabbedIndex === index}
            ondragstart={(/** @type {DragEvent} */ event) => {
              // A nested sortable list starts its own drag; the event just bubbles through here
              if (event.target !== event.currentTarget) {
                return;
              }

              dragIndex = index;
              previewOrder = [...displayOrder];
              // Let the editor pane scroll while the pointer is dragged near its top or
              // bottom edge, so a long list can be reordered without letting go
              startAutoScroll(itemList);

              if (event.dataTransfer) {
                event.dataTransfer.effectAllowed = 'move';
                // Firefox doesn’t start a drag unless some data is attached to it
                event.dataTransfer.setData('text/plain', _formatSummary(index, summaryTemplate));
              }
            }}
            ondragend={(/** @type {DragEvent} */ event) => {
              if (event.target !== event.currentTarget) {
                return;
              }

              stopAutoScroll();
              grabbedIndex = undefined;
              dragIndex = undefined;
              // A cancelled drag puts every item back where it started
              previewOrder = undefined;
            }}
          >
            <ObjectHeader
              label={hasVariableTypes ? typeConfig?.label || typeConfig?.name : ''}
              controlId="list-{fieldId}-item-{index}-body"
              {expanded}
              toggleExpanded={subFields.length
                ? () => syncExpanderStates({ [itemKeyPath]: !expanded })
                : undefined}
            >
              {#snippet centerContent()}
                {#if allowReorder}
                  <ReorderControls
                    {index}
                    itemCount={items.length}
                    disabled={isDuplicateField || items.length < 2}
                    icon="drag_handle"
                    onGrab={() => {
                      grabbedIndex = index;
                    }}
                    onRelease={() => {
                      grabbedIndex = undefined;
                    }}
                    onMove={(to, action) => moveItem(index, to, action)}
                  />
                {/if}
              {/snippet}
              {#snippet endContent()}
                {#if allowAdd}
                  <MenuButton
                    variant="ghost"
                    size="small"
                    iconic
                    popupPosition="bottom-right"
                    aria-label={_('list_item_options')}
                    disabled={isAddDisabled}
                  >
                    {#snippet popup()}
                      <Menu aria-label={_('list_item_options')}>
                        {#if allowDuplicate}
                          <MenuItem
                            label={_('duplicate')}
                            disabled={hasMaxItems}
                            onclick={() => addItem({ index: index + 1, dupIndex: index })}
                          />
                        {/if}
                        {@render addPositionItems(index, 'above')}
                        {@render addPositionItems(index + 1, 'below')}
                      </Menu>
                    {/snippet}
                  </MenuButton>
                {/if}
                {#if allowRemove}
                  <Button
                    variant="ghost"
                    size="small"
                    iconic
                    aria-label={_('remove')}
                    onclick={() => removeItem(index)}
                  >
                    {#snippet startIcon()}
                      <Icon name="close" />
                    {/snippet}
                  </Button>
                {/if}
              {/snippet}
            </ObjectHeader>
            <div role="none" class="item-body" id="list-{fieldId}-item-{index}-body">
              {#if expanded}
                {#each subFields as subField (subField.name)}
                  <VisibilityObserver>
                    <FieldEditor
                      keyPath={hasSingleSubField ? itemKeyPath : `${itemKeyPath}.${subField.name}`}
                      typedKeyPath={hasVariableTypes
                        ? `${typedKeyPath}.*<${type}>.${subField.name}`
                        : `${typedKeyPath}.*.${subField.name}`}
                      {locale}
                      fieldConfig={subField}
                      context={hasSingleSubField ? 'single-subfield-list-field' : undefined}
                    />
                  </VisibilityObserver>
                {/each}
              {:else}
                <div role="none" class="summary">
                  {#if thumbnails[index]}
                    <Image src={thumbnails[index]} variant="icon" cover />
                  {/if}
                  <TruncatedText lines={env.isSmallScreen ? 2 : 1}>
                    {_formatSummary(index, summaryTemplate)}
                  </TruncatedText>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </VisibilityObserver>
    </div>
  {/each}
</div>
{#if allowAdd && !addToTop && items.length && parentExpanded}
  <div role="none" class="toolbar bottom add">
    <Spacer flex />
    <AddItemButton disabled={isAddDisabled} {fieldConfig} {items} {addItem} />
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
      top: 0;
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
  }

  .item-list {
    display: flex;
    flex-direction: column;
    gap: 16px;

    &.collapsed {
      display: none;
    }
  }

  .item {
    flex: none;
    position: relative;
    border-width: 2px;
    border-color: var(--sui-secondary-border-color);
    border-radius: var(--sui-control-medium-border-radius);
    background-color: var(--sui-primary-background-color); /* for dragging opacity */

    /* The dragged item is left as a faint placeholder marking the gap it would drop into. The
      pointer already carries the browser’s own drag image of it, so showing it twice at full
      strength would just be confusing. */

    &.dragging {
      opacity: 0.25;
    }

    .summary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;

      &:empty {
        display: none;
      }
    }
  }
</style>
