<!--
  @component
  Implement the editor for the List widget.
  @see https://decapcms.org/docs/widgets/#list
-->
<script>
  import { Button, Group, Icon, Spacer, TextInput } from '@sveltia/ui';
  import { generateUUID } from '@sveltia/utils/crypto';
  import { sleep } from '@sveltia/utils/misc';
  import { escapeRegExp } from '@sveltia/utils/string';
  import { unflatten } from 'flat';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import AddItemButton from '$lib/components/contents/details/widgets/object/add-item-button.svelte';
  import ObjectHeader from '$lib/components/contents/details/widgets/object/object-header.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getDefaultValues } from '$lib/services/contents/draft/create';
  import { syncExpanderStates } from '$lib/services/contents/draft/editor';
  import { updateListField } from '$lib/services/contents/draft/update';
  import { defaultI18nConfig } from '$lib/services/contents/i18n';
  import { formatSummary } from '$lib/services/contents/widgets/list/helper';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  export let keyPath;
  /**
   * @type {string}
   */
  export let fieldId;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldLabel;
  /**
   * @type {ListField}
   */
  export let fieldConfig;
  /**
   * @type {string[]}
   */
  export let currentValue;
  /**
   * @type {boolean}
   */
  export let readonly = false;
  /**
   * @type {boolean}
   */
  export let required = false;
  /**
   * @type {boolean}
   */
  export let invalid = false;

  $: ({
    name: fieldName,
    label,
    i18n,
    // Widget-specific options
    allow_add: allowAdd = true,
    collapsed = false,
    summary,
    minimize_collapsed: minimizeCollapsed = false,
    label_singular: labelSingular,
    field,
    fields,
    // max,
    // min,
    add_to_top: addToTop = false,
    types,
    typeKey = 'type',
  } = fieldConfig);
  $: hasSingleSubField = !!field;
  $: hasMultiSubFields = Array.isArray(fields);
  $: hasVariableTypes = Array.isArray(types);
  $: hasSubFields = hasSingleSubField || hasMultiSubFields || hasVariableTypes;
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.(\\d+)(.*)?`);
  $: ({ collectionName, fileName, collection, collectionFile, currentValues, expanderStates } =
    $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ defaultLocale } = (collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  $: isDuplicateField = locale !== defaultLocale && i18n === 'duplicate';
  $: valueMap = currentValues[locale];
  $: parentExpandedKeyPath = `${keyPath}#`;
  $: parentExpanded = expanderStates?._[parentExpandedKeyPath] ?? true;

  /** @type {Record<string, any>[]} */
  $: items =
    unflatten(
      Object.fromEntries(
        Object.entries(valueMap)
          .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
          .map(([_keyPath, value]) => [
            _keyPath.replace(new RegExp(`^${escapeRegExp(keyPath)}`), fieldName),
            value,
          ]),
      ),
    )[fieldName] ?? [];

  $: itemExpanderStates = items.map((_item, index) => {
    const key = `${keyPath}.${index}`;

    return [key, expanderStates._[key] ?? true];
  });

  let mounted = false;
  let widgetId = '';
  let inputValue = '';

  onMount(() => {
    mounted = true;
    widgetId = generateUUID('short');

    // Initialize the expander state
    syncExpanderStates({
      [parentExpandedKeyPath]: !minimizeCollapsed,
      ...Object.fromEntries(
        items.map((__, index) => {
          const key = `${keyPath}.${index}`;

          return [key, expanderStates?._[key] ?? !collapsed];
        }),
      ),
    });
  });

  /**
   * Update {@link inputValue} when {@link currentValue} is reverted. This also cleans up the input
   * field value by removing extra spaces or commas.
   */
  const setInputValue = () => {
    const currentValueStr = currentValue.join(', ');

    // Avoid a cycle dependency & infinite loop
    if (!/,\s*$/.test(inputValue) && inputValue.trim() !== currentValueStr) {
      inputValue = currentValueStr;
    }
  };

  /**
   * Update the value for the List widget w/o subfield(s). This has to be called from the `input`
   * event handler on `<TextInput>`, not a `inputValue` reaction, because it causes an infinite loop
   * due to {@link setInputValue}.
   */
  const updateSimpleList = () => {
    const normalizedValue = inputValue
      .split(/,/g)
      .map((val) => val.trim())
      .filter((val) => val !== '');

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
   * @param {(arg: { valueList: any[], expanderStateList: boolean[] }) =>
   * void} manipulate - See {@link updateListField}.
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
   * @param {string} [typeName] - Variable type name. If the field doesn’t have variable types, it
   * will be `undefined`.
   * @see https://decapcms.org/docs/variable-type-widgets/
   */
  const addItem = (typeName) => {
    updateComplexList(({ valueList, expanderStateList }) => {
      const subFields = typeName
        ? (types?.find(({ name }) => name === typeName)?.fields ?? [])
        : (fields ?? (field ? [field] : []));

      const index = addToTop ? 0 : valueList.length;
      const newItem = unflatten(getDefaultValues(subFields, locale));

      if (typeName) {
        newItem[typeKey] = typeName;
      }

      valueList.splice(index, 0, hasSingleSubField && field ? newItem[field.name] : newItem);
      expanderStateList.splice(index, 0, true);
    });
  };

  /**
   * Remove a subfield.
   * @param {number} index - Target index.
   */
  const removeItem = (index) => {
    updateComplexList(({ valueList, expanderStateList }) => {
      valueList.splice(index, 1);
      expanderStateList.splice(index, 1);
    });
  };

  /**
   * Swap a subfield with the previous one.
   * @param {number} index - Target index.
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
   * @param {number} index - Target index.
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

  $: {
    if (mounted && !hasSubFields) {
      void currentValue;
      setInputValue();
    }
  }

  /**
   * Format the summary template.
   * @param {number} index - List index.
   * @param {string} [summaryTemplate] - Summary template, e.g. `{{fields.slug}}`.
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
        {@const expandedKeyPath = `${keyPath}.${index}`}
        {@const expanded = expanderStates?._[expandedKeyPath] ?? true}
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
            toggleExpanded={() => {
              syncExpanderStates({ [expandedKeyPath]: !expanded });
            }}
            removeButtonVisible={true}
            removeButtonDisabled={isDuplicateField}
            remove={() => {
              removeItem(index);
            }}
          >
            <Button
              size="small"
              iconic
              disabled={isDuplicateField || index === 0}
              aria-label={$_('move_up')}
              onclick={() => {
                moveUpItem(index);
              }}
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
              onclick={() => {
                moveDownItem(index);
              }}
            >
              {#snippet startIcon()}
                <Icon name="arrow_downward" />
              {/snippet}
            </Button>
          </ObjectHeader>
          <div role="none" class="item-body" id="list-{widgetId}-item-{index}-body">
            {#if expanded}
              {#each subFields as subField (subField.name)}
                {#await sleep(0) then}
                  <FieldEditor
                    keyPath={hasSingleSubField
                      ? `${keyPath}.${index}`
                      : `${keyPath}.${index}.${subField.name}`}
                    {locale}
                    fieldConfig={subField}
                  />
                {/await}
              {/each}
            {:else}
              <div role="none" class="summary">
                {_formatSummary(index, summaryTemplate)}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    {#if allowAdd && !addToTop && items.length}
      <div role="none" class="toolbar bottom">
        <AddItemButton disabled={isDuplicateField} {fieldConfig} {items} {addItem} />
        <Spacer flex />
      </div>
    {/if}
  {:else}
    <TextInput
      bind:value={inputValue}
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

  .summary {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .item-list {
    &.collapsed {
      display: none;
    }
  }

  .item {
    margin: 8px 0;
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
