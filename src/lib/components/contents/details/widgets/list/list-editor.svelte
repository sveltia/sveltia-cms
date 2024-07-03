<!--
  @component
  Implement the editor for the List widget.
  @see https://decapcms.org/docs/widgets/#list
-->
<script>
  import { Button, Group, Icon, Spacer, TextInput } from '@sveltia/ui';
  import { generateUUID } from '@sveltia/utils/crypto';
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
  import { getFieldDisplayValue } from '$lib/services/contents/entry';
  import { defaultI18nConfig, getListFormatter } from '$lib/services/contents/i18n';

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
  $: listFormatter = getListFormatter(locale);
  $: parentExpandedKeyPath = `${keyPath}#`;
  $: parentExpanded = expanderStates?._[parentExpandedKeyPath] ?? true;

  /** @type {Record<string, any>[]} */
  $: items =
    unflatten(
      Object.fromEntries(
        Object.entries(valueMap)
          .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
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
    if (!inputValue.match(/,\s*$/) && inputValue.trim() !== currentValueStr) {
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
   * @param {(arg: { valueList: any[], fileList: any[], expanderStateList: boolean[] }) =>
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
    updateComplexList(({ valueList, fileList, expanderStateList }) => {
      const subFields = typeName
        ? types?.find(({ name }) => name === typeName)?.fields ?? []
        : fields ?? (field ? [field] : []);

      const index = addToTop ? 0 : valueList.length;
      const newItem = unflatten(getDefaultValues(subFields, locale));

      if (typeName) {
        newItem[typeKey] = typeName;
      }

      valueList.splice(index, 0, hasSingleSubField && field ? newItem[field.name] : newItem);
      fileList.splice(index, 0, hasSingleSubField && field ? null : {});
      expanderStateList.splice(index, 0, true);
    });
  };

  /**
   * Remove a subfield.
   * @param {number} index - Target index.
   */
  const removeItem = (index) => {
    updateComplexList(({ valueList, fileList, expanderStateList }) => {
      valueList.splice(index, 1);
      fileList.splice(index, 1);
      expanderStateList.splice(index, 1);
    });
  };

  /**
   * Swap a subfield with the previous one.
   * @param {number} index - Target index.
   */
  const moveUpItem = (index) => {
    updateComplexList(({ valueList, fileList, expanderStateList }) => {
      [valueList[index], valueList[index - 1]] = [valueList[index - 1], valueList[index]];
      [fileList[index], fileList[index - 1]] = [fileList[index - 1], fileList[index]];
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
    updateComplexList(({ valueList, fileList, expanderStateList }) => {
      [valueList[index], valueList[index + 1]] = [valueList[index + 1], valueList[index]];
      [fileList[index], fileList[index + 1]] = [fileList[index + 1], fileList[index]];
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
   * @param {Record<string, any>} item - List item.
   * @param {number} index - List index.
   * @param {string} [summaryTemplate] - Summary template, e.g. `{{fields.slug}}`.
   * @returns {string} Formatted summary.
   */
  const formatSummary = (item, index, summaryTemplate) => {
    if (!summaryTemplate) {
      return (
        item.title ||
        item.name ||
        // Use the first string-type field value, if available
        Object.values(item).find((value) => typeof value === 'string' && !!value) ||
        ''
      );
    }

    return summaryTemplate.replaceAll(/{{fields\.(.+?)}}/g, (_match, _fieldName) => {
      const value = getFieldDisplayValue({
        collectionName,
        fileName,
        valueMap,
        keyPath: hasSingleSubField ? `${keyPath}.${index}` : `${keyPath}.${index}.${_fieldName}`,
        locale,
      });

      return Array.isArray(value) ? listFormatter.format(value) : String(value);
    });
  };
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
        on:click={() => {
          syncExpanderStates({ [parentExpandedKeyPath]: !parentExpanded });
        }}
      >
        <Icon slot="start-icon" name={parentExpanded ? 'expand_more' : 'chevron_right'} />
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
          on:click={() => {
            syncExpanderStates(Object.fromEntries(itemExpanderStates.map(([key]) => [key, true])));
          }}
        />
        <Button
          variant="tertiary"
          size="small"
          label={$_('collapse_all')}
          disabled={itemExpanderStates.every(([, value]) => !value)}
          on:click={() => {
            syncExpanderStates(Object.fromEntries(itemExpanderStates.map(([key]) => [key, false])));
          }}
        />
      {/if}
    </div>
    {#if parentExpanded && allowAdd && (addToTop || !items.length)}
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
          ? typeConfig?.fields ?? []
          : fields ?? (field ? [field] : [])}
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
            <svelte:fragment slot="middle">
              <Button
                size="small"
                iconic
                disabled={isDuplicateField || index === 0}
                aria-label={$_('move_up')}
                on:click={() => {
                  moveUpItem(index);
                }}
              >
                <Icon slot="start-icon" name="arrow_upward" />
              </Button>
              <Spacer />
              <Button
                iconic
                size="small"
                disabled={isDuplicateField || index === items.length - 1}
                aria-label={$_('move_down')}
                on:click={() => {
                  moveDownItem(index);
                }}
              >
                <Icon slot="start-icon" name="arrow_downward" />
              </Button>
            </svelte:fragment>
          </ObjectHeader>
          <div role="none" class="item-body" id="list-{widgetId}-item-{index}-body">
            {#if expanded}
              {#each subFields as subField (subField.name)}
                <FieldEditor
                  keyPath={hasSingleSubField
                    ? `${keyPath}.${index}`
                    : `${keyPath}.${index}.${subField.name}`}
                  {locale}
                  fieldConfig={subField}
                />
              {/each}
            {:else}
              <div role="none" class="summary">
                {formatSummary(item, index, summaryTemplate)}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    {#if parentExpanded && allowAdd && !addToTop && items.length}
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
      on:input={() => {
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
