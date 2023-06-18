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
  $: ({ defaultLocale = 'default' } = $entryDraft.collection._i18n);
  $: disabled = i18n === 'duplicate' && locale !== defaultLocale;
  $: hasSubFields = !!(field || fields || types);
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.(\\d+)(.*)?`);

  $: items =
    unflatten(
      Object.fromEntries(
        Object.entries($entryDraft.currentValues[locale])
          .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
          .map(([_keyPath, value]) => [
            _keyPath.replace(new RegExp(`^${escapeRegExp(keyPath)}`), fieldName),
            value,
          ]),
      ),
    )[fieldName] || [];

  $: parentExpanded = !minimizeCollapsed;
  $: itemExpandedList = items.map(() => !collapsed);

  let mounted = false;
  let widgetId = '';
  let inputValue = '';

  onMount(() => {
    mounted = true;
    widgetId = generateUUID().split('-').pop();
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
   * @param {Function} manipulate A function to manipulate the list, which takes one argument of the
   * list itself. The typical usage is `list.splice()`.
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
    updateComplexList((list) => {
      const newItem = {};

      const subFields = subFieldName
        ? types.find(({ name }) => name === subFieldName)?.fields || []
        : fields || [field];

      subFields.forEach(({ name, default: defaultValue }) => {
        const _defaultValue =
          isObject(defaultValues) && name in defaultValues ? defaultValues[name] : defaultValue;

        if (_defaultValue) {
          newItem[name] = _defaultValue;
        }
      });

      if (subFieldName) {
        newItem[typeKey] = subFieldName;
      }

      list.splice(addToTop ? 0 : list.length, 0, newItem);
    });
  };

  /**
   * Delete a subfield.
   * @param {number} index Target index.
   */
  const deleteItem = (index) => {
    updateComplexList((list) => {
      list.splice(index, 1);
    });
  };

  /**
   * Swap a subfield with the previous one.
   * @param {number} index Target index.
   */
  const moveUpItem = (index) => {
    updateComplexList((list) => {
      [list[index], list[index - 1]] = [list[index - 1], list[index]];
    });
  };

  /**
   * Swap a subfield with the next one.
   * @param {number} index Target index.
   */
  const moveDownItem = (index) => {
    updateComplexList((list) => {
      [list[index], list[index + 1]] = [list[index + 1], list[index]];
    });
  };

  $: {
    if (mounted && !hasSubFields) {
      // @ts-ignore Arguments are triggers
      updateInputValue(currentValue);
    }
  }
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
        <!-- @todo Support drag sorting. -->
        <div class="item">
          <div class="header">
            <div>
              <Button
                aria-expanded={itemExpandedList[index]}
                aria-controls="list-{widgetId}-item-{index}-body"
                on:click={() => {
                  itemExpandedList[index] = !itemExpandedList[index];
                }}
              >
                <Icon
                  slot="start-icon"
                  name={itemExpandedList[index] ? 'expand_more' : 'chevron_right'}
                  label={itemExpandedList[index] ? $_('collapse') : $_('expand')}
                />
                {#if types}
                  <span class="type">
                    {types.find(({ name }) => name === item[typeKey])?.label || ''}
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
            {#if itemExpandedList[index]}
              {@const subFieldName = Array.isArray(types)
                ? $entryDraft.currentValues[locale][`${keyPath}.${index}.${typeKey}`]
                : undefined}
              {@const subFields = subFieldName
                ? types.find(({ name }) => name === subFieldName)?.fields || []
                : fields || [field]}
              {#each subFields as subField (subField.name)}
                <FieldEditor
                  keyPath={[keyPath, index, subField.name].join('.')}
                  {locale}
                  fieldConfig={subField}
                />
              {/each}
            {:else}
              <div class="summary">
                {#if summary}
                  {summary.replaceAll(
                    /{{fields\.(.+?)}}/g,
                    (_match, _keyPath) =>
                      `${
                        $entryDraft.currentValues[locale][`${keyPath}.${index}.${_keyPath}`] || ''
                      }`,
                  )}
                {:else}
                  {item.title || item.name || Object.values(item)[0] || ''}
                {/if}
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
    border-color: var(--secondary-border-color);
    border-radius: var(--control--medium--border-radius);

    .header {
      display: flex;
      align-items: center;
      padding: 4px;
      background-color: var(--primary-border-color);

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
        font-size: var(--font-size--large);
      }

      .type {
        font-size: var(--font-size--small);
        font-weight: 600;
        color: var(--secondary-foreground-color);
      }
    }

    .summary {
      padding: 8px;
    }
  }
</style>
