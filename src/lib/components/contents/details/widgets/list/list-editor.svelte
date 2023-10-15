<!--
  @component
  Implement the editor for the List widget.
  @see https://decapcms.org/docs/widgets/#list
-->
<script>
  import { Button, Group, Icon, Spacer, TextInput } from '@sveltia/ui';
  import { unflatten } from 'flat';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import AddItemButton from '$lib/components/contents/details/widgets/list/add-item-button.svelte';
  import { entryDraft, updateListField } from '$lib/services/contents/editor';
  import { getFieldValue } from '$lib/services/contents/entry';
  import { isObject } from '$lib/services/utils/misc';
  import { escapeRegExp, generateUUID } from '$lib/services/utils/strings';

  export let locale = '';

  export let keyPath = '';

  /**
   * @type {ListField}
   */
  export let fieldConfig = undefined;

  /**
   * @type {string[]}
   */
  export let currentValue = undefined;

  /**
   * @type {boolean}
   */
  export let disabled = false;

  $: ({
    name: fieldName,
    label,
    i18n,
    // Widget-specific options
    default: defaultValues,
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
  $: ({ collectionName, fileName } = $entryDraft);
  $: valueMap = $entryDraft.currentValues[locale];
  $: listFormatter = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });

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
    )[fieldName] || [];

  $: parentExpanded = !minimizeCollapsed;

  let mounted = false;
  let widgetId = '';
  let inputValue = '';

  onMount(() => {
    mounted = true;
    widgetId = generateUUID().split('-').pop();

    items.forEach((__, index) => {
      $entryDraft.viewStates[locale][`${keyPath}.${index}.expanded`] = !collapsed;
    });
  });

  /**
   * Update the input field value when the {@link currentValue} is reverted. This also cleans up the
   * input field value by removing extra spaces or commas.
   */
  const updateInputValue = () => {
    const currentValueStr = currentValue.join(', ');

    if (!inputValue.match(/,\s*$/) && inputValue !== currentValueStr) {
      inputValue = currentValueStr;
    }
  };

  /**
   * Update the value for the List widget w/o subfield(s). This has to be called from the `input`
   * event handler on `<TextInput>`, not a `inputValue` reaction, because it causes an infinite loop
   * due to {@link updateInputValue}.
   */
  const updateSimpleList = () => {
    const normalizedValue = inputValue
      .split(/,/g)
      .map((val) => val.trim())
      .filter((val) => val !== '');

    Object.keys($entryDraft.currentValues).forEach((_locale) => {
      if (i18n !== 'duplicate' && _locale !== locale) {
        return;
      }

      Object.keys($entryDraft.currentValues[_locale]).forEach((_keyPath) => {
        if (_keyPath.match(new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`))) {
          delete $entryDraft.currentValues[_locale][_keyPath];
        }
      });

      normalizedValue.forEach((val, index) => {
        $entryDraft.currentValues[_locale][`${keyPath}.${index}`] = val;
      });
    });
  };

  /**
   * Update the value for the List widget with subfield(s).
   * @param {({ valueList, viewList }) => void} manipulate See {@link updateListField}.
   */
  const updateComplexList = (manipulate) => {
    Object.keys($entryDraft.currentValues).forEach((_locale) => {
      if (!(i18n !== 'duplicate' && _locale !== locale)) {
        updateListField(_locale, keyPath, manipulate);
      }
    });
  };

  /**
   * Add a new subfield to the list.
   * @param {string} [subFieldName] Sub field name from one of the variable type options.
   * @see https://decapcms.org/docs/beta-features/#list-widget-variable-types
   */
  const addItem = (subFieldName) => {
    updateComplexList(({ valueList, viewList }) => {
      let newItem = hasSingleSubField ? undefined : {};

      const subFields = subFieldName
        ? types.find(({ name }) => name === subFieldName)?.fields || []
        : fields || [field];

      subFields.forEach(({ name, default: defaultValue }) => {
        const _defaultValue =
          isObject(defaultValues) && name in defaultValues ? defaultValues[name] : defaultValue;

        if (_defaultValue) {
          if (hasSingleSubField) {
            newItem = _defaultValue;
          } else {
            newItem[name] = _defaultValue;
          }
        }
      });

      if (subFieldName) {
        newItem[typeKey] = subFieldName;
      }

      const index = addToTop ? 0 : valueList.length;

      valueList.splice(index, 0, newItem);
      viewList.splice(index, 0, { expanded: true });
    });
  };

  /**
   * Delete a subfield.
   * @param {number} index Target index.
   */
  const deleteItem = (index) => {
    updateComplexList(({ valueList, viewList }) => {
      valueList.splice(index, 1);
      viewList.splice(index, 1);
    });
  };

  /**
   * Swap a subfield with the previous one.
   * @param {number} index Target index.
   */
  const moveUpItem = (index) => {
    updateComplexList(({ valueList, viewList }) => {
      [valueList[index], valueList[index - 1]] = [valueList[index - 1], valueList[index]];
      [viewList[index], viewList[index - 1]] = [viewList[index - 1], viewList[index]];
    });
  };

  /**
   * Swap a subfield with the next one.
   * @param {number} index Target index.
   */
  const moveDownItem = (index) => {
    updateComplexList(({ valueList, viewList }) => {
      [valueList[index], valueList[index + 1]] = [valueList[index + 1], valueList[index]];
      [viewList[index], viewList[index + 1]] = [viewList[index + 1], viewList[index]];
    });
  };

  $: {
    if (mounted && !hasSubFields) {
      // @ts-ignore Arguments are triggers
      updateInputValue(currentValue);
    }
  }

  /**
   * Format the summary template.
   * @param {object} item List item.
   * @param {number} index List index.
   * @param {string} [summaryTemplate] Summary template, e.g. `{{fields.slug}}`.
   * @returns {string} Formatted summary.
   */
  const formatSummary = (item, index, summaryTemplate) => {
    if (!summaryTemplate) {
      return item.title || item.name || '';
    }

    return summaryTemplate.replaceAll(/{{fields\.(.+?)}}/g, (_match, _fieldName) => {
      const value = getFieldValue({
        collectionName,
        fileName,
        valueMap,
        keyPath: hasSingleSubField ? `${keyPath}.${index}` : `${keyPath}.${index}.${_fieldName}`,
        locale,
      });

      return Array.isArray(value) ? listFormatter.format(value) : value || '';
    });
  };
</script>

<Group aria-labelledby="list-{widgetId}-summary">
  {#if hasSubFields}
    <div class="toolbar top">
      <Button
        disabled={!items.length}
        aria-expanded={parentExpanded}
        aria-controls="list-{widgetId}-item-list"
        on:click={() => {
          parentExpanded = !parentExpanded;
        }}
      >
        <Icon
          slot="start-icon"
          name={parentExpanded ? 'expand_more' : 'chevron_right'}
          label={parentExpanded ? $_('collapse') : $_('expand')}
        />
      </Button>
      <div class="summary" id="oblect-{widgetId}-summary">
        {`${items.length} ${items.length === 1 ? labelSingular || label : label}`}
      </div>
      <Spacer flex />
      {#if allowAdd && (addToTop || !items.length)}
        <AddItemButton {fieldConfig} {items} {addItem} />
      {/if}
    </div>
    <div class="item-list" id="list-{widgetId}-item-list" class:collapsed={!parentExpanded}>
      {#each items as item, index}
        {@const expanded = !!$entryDraft.viewStates[locale][`${keyPath}.${index}.expanded`]}
        {@const typeConfig = hasVariableTypes
          ? types.find(({ name }) => name === item[typeKey])
          : undefined}
        {@const subFields = hasVariableTypes ? typeConfig?.fields || [] : fields || [field]}
        {@const summaryTemplate = hasVariableTypes ? typeConfig?.summary || summary : summary}
        <!-- @todo Support drag sorting. -->
        <div class="item">
          <div class="header">
            <div>
              <Button
                aria-expanded={expanded}
                aria-controls="list-{widgetId}-item-{index}-body"
                on:click={() => {
                  Object.keys($entryDraft.viewStates).forEach((_locale) => {
                    $entryDraft.viewStates[_locale][`${keyPath}.${index}.expanded`] = !expanded;
                  });
                }}
              >
                <Icon
                  slot="start-icon"
                  name={expanded ? 'expand_more' : 'chevron_right'}
                  label={expanded ? $_('collapse') : $_('expand')}
                />
                {#if hasVariableTypes}
                  <span class="type">
                    {typeConfig?.label || typeConfig?.name || ''}
                  </span>
                {/if}
              </Button>
            </div>
            <div>
              <Button
                disabled={index === 0}
                on:click={() => {
                  moveUpItem(index);
                }}
              >
                <Icon slot="start-icon" name="arrow_upward" label={$_('move_up')} />
              </Button>
              <Spacer />
              <Button
                disabled={index === items.length - 1}
                on:click={() => {
                  moveDownItem(index);
                }}
              >
                <Icon slot="start-icon" name="arrow_downward" label={$_('move_down')} />
              </Button>
            </div>
            <div>
              <Button
                on:click={() => {
                  deleteItem(index);
                }}
              >
                <Icon slot="start-icon" name="close" label={$_('delete')} />
              </Button>
            </div>
          </div>
          <div class="item-body" id="list-{widgetId}-item-{index}-body">
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
              <div class="summary">
                {formatSummary(item, index, summaryTemplate)}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
    {#if allowAdd && !addToTop && items.length}
      <div class="toolbar bottom">
        <Spacer flex />
        <AddItemButton {fieldConfig} {items} {addItem} />
      </div>
    {/if}
  {:else}
    <TextInput
      {disabled}
      bind:value={inputValue}
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
    gap: 8px;
  }

  .item-list {
    &.collapsed {
      display: none;
    }
  }

  .item {
    margin: 4px 0;
    border-width: 2px;
    border-color: var(--sui-secondary-border-color);
    border-radius: var(--sui-control-medium-border-radius);

    .header {
      display: flex;
      align-items: center;
      padding: 4px;
      background-color: var(--sui-primary-border-color);

      & > div {
        display: flex;
        align-items: center;

        &:first-child {
          justify-content: flex-start;
          width: 40%;
        }

        &:nth-child(2) {
          width: 20%;
          justify-content: center;
        }

        &:last-child {
          width: 40%;
          justify-content: flex-end;
        }
      }

      :global(.icon) {
        font-size: var(--sui-font-size-large);
      }

      .type {
        font-size: var(--sui-font-size-small);
        font-weight: 600;
        color: var(--sui-secondary-foreground-color);
      }
    }

    .summary {
      overflow: hidden;
      padding: 8px;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }
</style>
