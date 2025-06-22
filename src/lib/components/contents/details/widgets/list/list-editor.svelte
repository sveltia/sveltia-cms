<!--
  @component
  Implement the editor for the List widget.
  @see https://decapcms.org/docs/widgets/#list
-->
<script>
  import {
    Button,
    Group,
    Icon,
    Menu,
    MenuButton,
    MenuItem,
    Spacer,
    TextArea,
    TruncatedText,
  } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { escapeRegExp } from '@sveltia/utils/string';
  import { unflatten } from 'flat';
  import { onMount, untrack } from 'svelte';
  import { _ } from 'svelte-i18n';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import AddItemButton from '$lib/components/contents/details/widgets/object/add-item-button.svelte';
  import ObjectHeader from '$lib/components/contents/details/widgets/object/object-header.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getDefaultValues } from '$lib/services/contents/draft/defaults';
  import { getInitialExpanderState, syncExpanderStates } from '$lib/services/contents/draft/editor';
  import { updateListField } from '$lib/services/contents/draft/update';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n';
  import { formatSummary } from '$lib/services/contents/widgets/list/helper';
  import { isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { EntryDraft, WidgetEditorProps } from '$lib/types/private';
   * @import { ListField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ListField} fieldConfig Field configuration.
   * @property {string[]} currentValue Field value.
   */

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldId,
    fieldConfig,
    currentValue,
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  const widgetId = $props.id();

  let mounted = $state(false);
  let inputValue = $state('');

  const {
    name: fieldName,
    label,
    i18n,
    // Widget-specific options
    allow_add: allowAdd = true,
    collapsed,
    summary,
    minimize_collapsed: minimizeCollapsed = false,
    label_singular: labelSingular,
    field,
    fields,
    max = Infinity,
    add_to_top: addToTop = false,
    types,
    typeKey = 'type',
  } = $derived(fieldConfig);
  const hasSingleSubField = $derived(!!field);
  const hasMultiSubFields = $derived(Array.isArray(fields));
  const hasVariableTypes = $derived(Array.isArray(types));
  const hasSubFields = $derived(hasSingleSubField || hasMultiSubFields || hasVariableTypes);
  const keyPathRegex = $derived(new RegExp(`^${escapeRegExp(keyPath)}\\.(\\d+)(.*)?`));
  const isIndexFile = $derived($entryDraft?.isIndexFile ?? false);
  const collection = $derived($entryDraft?.collection);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const collectionFile = $derived($entryDraft?.collectionFile);
  const fileName = $derived($entryDraft?.fileName);
  const { defaultLocale } = $derived((collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG);
  const isDuplicateField = $derived(locale !== defaultLocale && i18n === 'duplicate');
  const valueMap = $derived($state.snapshot($entryDraft?.currentValues[locale]) ?? {});
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
   * Update {@link inputValue} when {@link currentValue} is updated.
   */
  const setInputValue = () => {
    inputValue = currentValue?.join('\n') ?? '';
  };

  /**
   * Update the value for the List widget w/o subfield(s). This has to be called from the `input`
   * event handler on `<TextArea>`, not a `inputValue` reaction, because it causes an infinite loop
   * due to {@link setInputValue}.
   */
  const updateSimpleList = () => {
    const normalizedValue = inputValue.split(/\n/g);

    Object.keys($entryDraft?.currentValues ?? {}).forEach((_locale) => {
      if (i18n !== 'duplicate' && _locale !== locale) {
        return;
      }

      Object.keys($entryDraft?.currentValues[_locale] ?? {}).forEach((_keyPath) => {
        if (_keyPath.match(`^${escapeRegExp(keyPath)}\\.\\d+$`)) {
          delete $entryDraft?.currentValues[_locale][_keyPath];
        }
      });

      normalizedValue.forEach((val, index) => {
        /** @type {EntryDraft} */ ($entryDraft).currentValues[_locale][`${keyPath}.${index}`] = val;
      });
    });
  };

  /**
   * Update the value for the List widget with subfield(s).
   * @param {(arg: { valueList: any[], expanderStateList: boolean[] }) => void} manipulate
   * See {@link updateListField}.
   */
  const updateComplexList = (manipulate) => {
    Object.keys($entryDraft?.currentValues ?? {}).forEach((_locale) => {
      if (!(i18n !== 'duplicate' && _locale !== locale)) {
        updateListField(_locale, keyPath, manipulate);
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
   * Swap a subfield with the previous one.
   * @param {number} index Target index.
   */
  const moveUpItem = (index) => {
    updateComplexList(({ valueList, expanderStateList }) => {
      [valueList[index], valueList[index - 1]] = [valueList[index - 1], valueList[index]];
      [expanderStateList[index], expanderStateList[index - 1]] = [
        expanderStateList[index - 1],
        expanderStateList[index],
      ];
    });
  };

  /**
   * Swap a subfield with the next one.
   * @param {number} index Target index.
   */
  const moveDownItem = (index) => {
    updateComplexList(({ valueList, expanderStateList }) => {
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

  onMount(() => {
    mounted = true;
    initializeExpanderState();
  });

  $effect(() => {
    if (mounted && !hasSubFields) {
      void [currentValue];

      untrack(() => {
        setInputValue();
      });
    }
  });
</script>

<Group aria-labelledby="list-{widgetId}-summary">
  {#if hasSubFields}
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
          <Icon name={parentExpanded ? 'expand_more' : 'chevron_right'} />
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
      <div role="none" class="toolbar top">
        <AddItemButton disabled={isDuplicateField} {fieldConfig} {items} {addItem} />
      </div>
    {/if}
    <div
      role="none"
      id="list-{widgetId}-item-list"
      class="item-list"
      class:collapsed={!parentExpanded}
    >
      {#each items as item, index}
        {#await sleep() then}
          {@const expandedKeyPath = `${keyPath}.${index}`}
          {@const expanded = $entryDraft?.expanderStates?._[expandedKeyPath] ?? true}
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
                ? () => syncExpanderStates({ [expandedKeyPath]: !expanded })
                : undefined}
            >
              {#snippet centerContent()}
                <Button
                  size="small"
                  iconic
                  disabled={isDuplicateField || index === 0}
                  aria-label={$_('move_up')}
                  onclick={() => moveUpItem(index)}
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
              {/snippet}
              {#snippet endContent()}
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
              {/snippet}
            </ObjectHeader>
            <div role="none" class="item-body" id="list-{widgetId}-item-{index}-body">
              {#if expanded}
                {#each subFields as subField (subField.name)}
                  {#await sleep() then}
                    <FieldEditor
                      keyPath={hasSingleSubField
                        ? `${keyPath}.${index}`
                        : `${keyPath}.${index}.${subField.name}`}
                      {locale}
                      fieldConfig={subField}
                      context={hasSingleSubField ? 'single-field-list-widget' : undefined}
                    />
                  {/await}
                {/each}
              {:else}
                <div role="none" class="summary">
                  <TruncatedText lines={$isSmallScreen ? 2 : 1}>
                    {_formatSummary(index, summaryTemplate)}
                  </TruncatedText>
                </div>
              {/if}
            </div>
          </div>
        {/await}
      {/each}
    </div>
    {#if allowAdd && !addToTop && items.length}
      <div role="none" class="toolbar bottom">
        <AddItemButton disabled={isDuplicateField} {fieldConfig} {items} {addItem} />
        <Spacer flex />
      </div>
    {/if}
  {:else}
    <TextArea
      bind:value={inputValue}
      autoResize={true}
      flex
      {readonly}
      {required}
      {invalid}
      aria-errormessage="{fieldId}-error"
      oninput={() => {
        updateSimpleList();
      }}
    />
  {/if}
</Group>

<style lang="scss">
  .toolbar {
    display: flex;
    align-items: center;
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
      padding: 8px;

      &:empty {
        display: none;
      }
    }
  }
</style>
