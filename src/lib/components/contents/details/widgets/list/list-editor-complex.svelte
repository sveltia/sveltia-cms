<!--
  @component
  Implement the editor for the List widget with subfield(s).
  @see https://decapcms.org/docs/widgets/#List
-->
<script>
  import { Button, Icon, Menu, MenuButton, MenuItem, Spacer, TruncatedText } from '@sveltia/ui';
  import { isObject } from '@sveltia/utils/object';
  import { escapeRegExp } from '@sveltia/utils/string';
  import { unflatten } from 'flat';
  import { getContext, onMount, untrack } from 'svelte';
  import { _ } from 'svelte-i18n';

  import Image from '$lib/components/assets/shared/image.svelte';
  import ExpandIcon from '$lib/components/common/expand-icon.svelte';
  import VisibilityObserver from '$lib/components/common/visibility-observer.svelte';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import AddItemButton from '$lib/components/contents/details/widgets/object/add-item-button.svelte';
  import ObjectHeader from '$lib/components/contents/details/widgets/object/object-header.svelte';
  import { getMediaFieldURL } from '$lib/services/assets/info';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getDefaultValues } from '$lib/services/contents/draft/defaults';
  import { updateListField } from '$lib/services/contents/draft/update/list';
  import {
    getInitialExpanderState,
    syncExpanderStates,
  } from '$lib/services/contents/editor/expanders';
  import { getField } from '$lib/services/contents/entry/fields';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
  import { formatSummary, getListFieldInfo } from '$lib/services/contents/widgets/list/helper';
  import { isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { FieldEditorContext, WidgetEditorProps } from '$lib/types/private';
   * @import {
   * ComplexListField,
   * ListFieldWithSubField,
   * ListFieldWithSubFields,
   * ListFieldWithTypes,
   * } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ComplexListField} fieldConfig Field configuration.
   * @property {string[]} currentValue Field value.
   */

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldConfig,
    /* eslint-enable prefer-const */
  } = $props();

  const widgetId = $props.id();

  const {
    name: fieldName,
    label,
    i18n,
    // Widget-specific options
    allow_add: allowAdd = true,
    allow_remove: allowRemove = true,
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
  const valueMap = $derived($state.snapshot($entryDraft?.[valueStoreKey][locale]) ?? {});
  const parentExpandedKeyPath = $derived(`${keyPath}#`);
  const parentExpanded = $derived($entryDraft?.expanderStates?._[parentExpandedKeyPath] ?? true);
  /** @type {Record<string, any>[]} */
  const items = $derived(
    unflatten(
      Object.fromEntries(
        Object.entries(valueMap)
          .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
          .map(([_keyPath, value]) => [
            _keyPath.replace(new RegExp(`^${escapeRegExp(keyPath)}`), fieldName),
            value,
          ]),
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

  /**
   * List item thumbnails.
   * @type {(string | undefined)[]}
   */
  const thumbnails = $state([]);

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
   * Update the value for the List widget with subfield(s).
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
   * Add a new subfield to the list.
   * @param {object} [args] Arguments.
   * @param {number} [args.index] List index where a new item will be inserted.
   * @param {number} [args.dupIndex] List index of an item to be duplicated.
   * @param {string} [args.type] Variable type name. If the field doesn’t have variable types, it
   * will be `undefined`.
   * @see https://decapcms.org/docs/variable-type-widgets/
   */
  const addItem = ({ index = addToTop ? 0 : items.length, dupIndex, type } = {}) => {
    updateComplexList(({ valueList, expanderStateList }) => {
      const subFields = type
        ? (types?.find(({ name }) => name === type)?.fields ?? [])
        : (fields ?? (field ? [field] : []));

      const newItem = (() => {
        if (typeof dupIndex === 'number') {
          return structuredClone(valueList[dupIndex]);
        }

        const item = unflatten(getDefaultValues(subFields, locale));

        return hasSingleSubField && field ? item[field.name] : item;
      })();

      if (type) {
        newItem[typeKey] = type;
      }

      if (!hasSingleSubField) {
        // Add a random ID to the new item to ensure it is unique. This is necessary for the `key`
        // attribute in the `each` block.
        newItem.__sc_item_id = crypto.randomUUID();
      }

      valueList.splice(index, 0, newItem);
      expanderStateList.splice(index, 0, true);
    });

    // Expand the parent if it is collapsed to show the newly added item
    syncExpanderStates({ [parentExpandedKeyPath]: true });
  };

  /**
   * Remove a subfield.
   * @param {number} index Target index.
   */
  const removeItem = (index) => {
    updateComplexList(({ valueList, expanderStateList }) => {
      valueList.splice(index, 1);
      expanderStateList.splice(index, 1);
    });
  };

  /**
   * Swap a subfield with the next one.
   * @param {number} index Target index.
   */
  const moveDownItem = (index) => {
    updateComplexList(({ valueList, expanderStateList }) => {
      if (!hasSingleSubField) {
        // Ensure the IDs are unique before swapping
        valueList[index].__sc_item_id ??= crypto.randomUUID();
        valueList[index + 1].__sc_item_id ??= crypto.randomUUID();
      }

      [valueList[index], valueList[index + 1]] = [valueList[index + 1], valueList[index]];
      [expanderStateList[index], expanderStateList[index + 1]] = [
        expanderStateList[index + 1],
        expanderStateList[index],
      ];
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

  /**
   * Get the thumbnail image URL for a list item.
   * @param {number} index List index.
   * @returns {Promise<string | undefined>} Thumbnail image URL.
   */
  const getThumbnail = async (index) => {
    if (!thumbnailFieldName) {
      return undefined;
    }

    const thumbnailKeyPath = `${keyPath}.${index}.${thumbnailFieldName.replace(/^fields\./, '')}`;
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

    if (thumbnailFieldConfig?.widget !== 'image') {
      return undefined;
    }

    return getMediaFieldURL({
      value: thumbnailValue,
      entry: $entryDraft?.originalEntry,
      collectionName,
      fileName,
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

<div role="none" class="toolbar top">
  <Button
    iconic
    disabled={!items.length}
    aria-label={parentExpanded ? $_('collapse') : $_('expand')}
    aria-expanded={parentExpanded}
    aria-controls="list-{widgetId}-item-list"
    onclick={() => {
      syncExpanderStates({ [parentExpandedKeyPath]: !parentExpanded });
    }}
  >
    {#snippet startIcon()}
      <ExpandIcon expanded={parentExpanded} />
    {/snippet}
  </Button>
  <div role="none" class="summary" id="object-{widgetId}-summary">
    {items.length}
    {(items.length === 1 ? labelSingular : undefined) || label || fieldName}
  </div>
  <Spacer flex />
  {#if parentExpanded && items.length > 1}
    <Button
      variant="tertiary"
      size="small"
      label={$_('expand_all')}
      disabled={itemExpanderStates.every(([, value]) => value)}
      onclick={() => {
        syncExpanderStates(Object.fromEntries(itemExpanderStates.map(([key]) => [key, true])));
      }}
    />
    <Button
      variant="tertiary"
      size="small"
      label={$_('collapse_all')}
      disabled={itemExpanderStates.every(([, value]) => !value)}
      onclick={() => {
        syncExpanderStates(Object.fromEntries(itemExpanderStates.map(([key]) => [key, false])));
      }}
    />
  {/if}
</div>
{#if allowAdd && (addToTop || !items.length)}
  <div role="none" class="toolbar top add">
    <AddItemButton disabled={isDuplicateField} {fieldConfig} {items} {addItem} />
  </div>
{/if}
<div role="none" id="list-{widgetId}-item-list" class="item-list" class:collapsed={!parentExpanded}>
  {#each items as item, index (isObject(item) ? (item.__sc_item_id ?? index) : index)}
    <VisibilityObserver>
      {@const itemKeyPath = `${keyPath}.${index}`}
      {@const expanded = $entryDraft?.expanderStates?._[itemKeyPath] ?? true}
      {@const typeConfig = hasVariableTypes
        ? types?.find(({ name }) => name === item[typeKey])
        : undefined}
      {@const subFields = hasVariableTypes
        ? (typeConfig?.fields ?? [])
        : (fields ?? (field ? [field] : []))}
      {@const summaryTemplate = hasVariableTypes ? typeConfig?.summary || summary : summary}
      <!-- @todo Support drag sorting. -->
      <div role="none" class="item">
        <ObjectHeader
          label={hasVariableTypes ? typeConfig?.label || typeConfig?.name : ''}
          controlId="list-{widgetId}-item-{index}-body"
          {expanded}
          toggleExpanded={subFields.length
            ? () => syncExpanderStates({ [itemKeyPath]: !expanded })
            : undefined}
        >
          {#snippet centerContent()}
            {#if allowReorder}
              <Button
                size="small"
                iconic
                disabled={isDuplicateField || index === 0}
                aria-label={$_('move_up')}
                onclick={() => moveDownItem(index - 1)}
              >
                {#snippet startIcon()}
                  <Icon name="arrow_upward" />
                {/snippet}
              </Button>
              <Spacer />
              <Button
                iconic
                size="small"
                disabled={isDuplicateField || index === items.length - 1}
                aria-label={$_('move_down')}
                onclick={() => moveDownItem(index)}
              >
                {#snippet startIcon()}
                  <Icon name="arrow_downward" />
                {/snippet}
              </Button>
            {/if}
          {/snippet}
          {#snippet endContent()}
            {#if allowAdd}
              <MenuButton
                variant="ghost"
                size="small"
                iconic
                popupPosition="bottom-right"
                aria-label={$_('list_item_options')}
                disabled={isDuplicateField}
              >
                {#snippet popup()}
                  <Menu aria-label={$_('translation_options')}>
                    <MenuItem
                      label={$_('duplicate')}
                      disabled={hasMaxItems}
                      onclick={() => addItem({ index: index + 1, dupIndex: index })}
                    />
                    {#if hasVariableTypes}
                      <MenuItem label={$_('add_item_above')} disabled={hasMaxItems}>
                        <!-- eslint-disable-next-line no-shadow -->
                        {#snippet items()}
                          {#each types ?? [] as { name, label: itemLabel } (name)}
                            <MenuItem
                              label={itemLabel || name}
                              onclick={() => addItem({ index, type: name })}
                            />
                          {/each}
                        {/snippet}
                      </MenuItem>
                      <MenuItem label={$_('add_item_below')} disabled={hasMaxItems}>
                        <!-- eslint-disable-next-line no-shadow -->
                        {#snippet items()}
                          {#each types ?? [] as { name, label: itemLabel } (name)}
                            <MenuItem
                              label={itemLabel || name}
                              onclick={() => addItem({ index: index + 1, type: name })}
                            />
                          {/each}
                        {/snippet}
                      </MenuItem>
                    {:else}
                      <MenuItem
                        label={$_('add_item_above')}
                        disabled={hasMaxItems}
                        onclick={() => addItem({ index })}
                      />
                      <MenuItem
                        label={$_('add_item_below')}
                        disabled={hasMaxItems}
                        onclick={() => addItem({ index: index + 1 })}
                      />
                    {/if}
                  </Menu>
                {/snippet}
              </MenuButton>
            {/if}
            {#if allowRemove}
              <Button
                variant="ghost"
                size="small"
                iconic
                aria-label={$_('remove')}
                onclick={() => removeItem(index)}
              >
                {#snippet startIcon()}
                  <Icon name="close" />
                {/snippet}
              </Button>
            {/if}
          {/snippet}
        </ObjectHeader>
        <div role="none" class="item-body" id="list-{widgetId}-item-{index}-body">
          {#if expanded}
            {#each subFields as subField (subField.name)}
              <VisibilityObserver>
                <FieldEditor
                  keyPath={hasSingleSubField ? itemKeyPath : `${itemKeyPath}.${subField.name}`}
                  typedKeyPath={hasVariableTypes
                    ? `${keyPath}.*<${item[typeKey]}>.${subField.name}`
                    : `${keyPath}.*.${subField.name}`}
                  {locale}
                  fieldConfig={subField}
                  context={hasSingleSubField ? 'single-subfield-list-widget' : undefined}
                />
              </VisibilityObserver>
            {/each}
          {:else}
            <div role="none" class="summary">
              {#if thumbnails[index]}
                <Image src={thumbnails[index]} variant="icon" cover />
              {/if}
              <TruncatedText lines={$isSmallScreen ? 2 : 1}>
                {_formatSummary(index, summaryTemplate)}
              </TruncatedText>
            </div>
          {/if}
        </div>
      </div>
    </VisibilityObserver>
  {/each}
</div>
{#if allowAdd && !addToTop && items.length}
  <div role="none" class="toolbar bottom add">
    <AddItemButton disabled={isDuplicateField} {fieldConfig} {items} {addItem} />
    <Spacer flex />
  </div>
{/if}

<style lang="scss">
  .toolbar {
    display: flex;
    align-items: center;

    &.top.add {
      margin-block: 8px 16px !important;
    }

    &.bottom.add {
      margin-block: 16px 0 !important;
    }
  }

  .item-list {
    &.collapsed {
      display: none;
    }
  }

  .item {
    margin: 16px 0;
    border-width: 2px;
    border-color: var(--sui-secondary-border-color);
    border-radius: var(--sui-control-medium-border-radius);

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
