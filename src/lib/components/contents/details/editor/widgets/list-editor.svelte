<!--
  @component
  Implement the editor for the List widget.
  @see https://www.netlifycms.org/docs/widgets/#list
-->
<script>
  import { Button, Group, Spacer, TextInput } from '@sveltia/ui';
  import { unflatten } from 'flat';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import { defaultContentLocale } from '$lib/services/config';
  import { getFieldByKeyPath } from '$lib/services/contents';
  import { entryDraft } from '$lib/services/contents/editor';
  import { isObject } from '$lib/services/utils/misc';
  import { escapeRegExp } from '$lib/services/utils/strings';

  export let locale = '';
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({
    name: fieldName,
    label,
    i18n,
    // Widget-specific options
    default: defaultValue,
    allow_add: allowAdd = true,
    collapsed = false,
    summary,
    minimize_collapsed: minimizeCollapsed = false,
    label_singular: labelSingular,
    field,
    fields,
    max,
    min,
    add_to_top: addToTop,
  } = fieldConfig);
  $: disabled = i18n === 'duplicate' && locale !== $defaultContentLocale;
  $: hasSubFields = field || fields;
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.(\\d+)(.*)?`);
  $: ({ collectionName, fileName } = $entryDraft);

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
  let widgetId;
  let initialValue = [];
  let inputValue = '';

  onMount(() => {
    mounted = true;
    widgetId = window.crypto.randomUUID().split('-').pop();

    if (hasSubFields) {
      //
    } else if (Array.isArray(currentValue)) {
      initialValue = currentValue;
      inputValue = currentValue.join(', ');
    }
  });

  /**
   * Update the value for the List widget w/o subfield(s).
   */
  const updateSimpleListValue = () => {
    const normalizedValue = inputValue
      .match(/^\s*(?:,\s*)?(.*?)(?:\s*,)?\s*$/)[1]
      .split(/,\s*/g)
      .filter((val) => val !== undefined);

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
   * Add a new subfield to the list.
   *
   * @param {boolean} [toTop] Whether to add a new item at the beginning of the list.
   */
  const addItem = (toTop = false) => {
    Object.keys($entryDraft.currentValues).forEach((_locale) => {
      if (i18n !== 'duplicate' && _locale !== locale) {
        return;
      }

      if (toTop) {
        // Increase the index, e.g. `foo.bar.0` -> `foo.bar.1`, before adding `foo.bar.0`
        Object.keys($entryDraft.currentValues[_locale])
          .reverse()
          .forEach((_keyPath) => {
            if (_keyPath.match(keyPathRegex)) {
              const newKeyPath = _keyPath.replace(
                keyPathRegex,
                (_match, p1, p2) => `${keyPath}.${Number(p1) + 1}${p2}`,
              );

              $entryDraft.currentValues[_locale][newKeyPath] =
                $entryDraft.currentValues[_locale][_keyPath];
            }
          });
      }

      (fields || [field]).forEach(({ name }) => {
        const _keyPath = `${keyPath}.${toTop ? 0 : items.length}.${name}`;

        $entryDraft.currentValues[_locale][_keyPath] =
          isObject(defaultValue) && name in defaultValue
            ? defaultValue[name]
            : getFieldByKeyPath(collectionName, fileName, _keyPath).default;
      });
    });
  };

  /**
   * Delete a subfield.
   *
   * @param {number} index Target index.
   */
  const deleteItem = (index) => {
    Object.keys($entryDraft.currentValues).forEach((_locale) => {
      if (i18n !== 'duplicate' && _locale !== locale) {
        return;
      }

      Object.keys($entryDraft.currentValues[_locale]).forEach((_keyPath) => {
        const [, matchedIndexStr] = _keyPath.match(keyPathRegex) || [];
        const matchedIndex = matchedIndexStr !== undefined ? Number(matchedIndexStr) : undefined;

        if (matchedIndex === undefined) {
          return;
        }

        if (matchedIndex === index) {
          delete $entryDraft.currentValues[_locale][_keyPath];
        }

        if (matchedIndex > index) {
          // Decrease index
          const newKeyPath = _keyPath.replace(
            keyPathRegex,
            (_match, p1, p2) => `${keyPath}.${Number(p1) - 1}${p2}`,
          );

          $entryDraft.currentValues[_locale][newKeyPath] =
            $entryDraft.currentValues[_locale][_keyPath];
        }
      });

      // `delete` doesn’t update the store, so reassign the value
      $entryDraft.currentValues[_locale] = $entryDraft.currentValues[_locale];
    });
  };

  /**
   * Swap a subfield with the previous one.
   *
   * @param {number} index Target index.
   */
  const moveUpItem = (index) => {
    Object.keys($entryDraft.currentValues).forEach((_locale) => {
      if (i18n !== 'duplicate' && _locale !== locale) {
        return;
      }

      (fields || [field]).forEach(({ name }) => {
        [
          $entryDraft.currentValues[_locale][`${keyPath}.${index}.${name}`],
          $entryDraft.currentValues[_locale][`${keyPath}.${index - 1}.${name}`],
        ] = [
          $entryDraft.currentValues[_locale][`${keyPath}.${index - 1}.${name}`],
          $entryDraft.currentValues[_locale][`${keyPath}.${index}.${name}`],
        ];
      });
    });
  };

  /**
   * Swap a subfield with the next one.
   *
   * @param {number} index Target index.
   */
  const moveDownItem = (index) => {
    Object.keys($entryDraft.currentValues).forEach((_locale) => {
      if (i18n !== 'duplicate' && _locale !== locale) {
        return;
      }

      (fields || [field]).forEach(({ name }) => {
        [
          $entryDraft.currentValues[_locale][`${keyPath}.${index + 1}.${name}`],
          $entryDraft.currentValues[_locale][`${keyPath}.${index}.${name}`],
        ] = [
          $entryDraft.currentValues[_locale][`${keyPath}.${index}.${name}`],
          $entryDraft.currentValues[_locale][`${keyPath}.${index + 1}.${name}`],
        ];
      });
    });
  };

  $: {
    if (mounted && !hasSubFields) {
      updateSimpleListValue(inputValue);
    }
  }
</script>

<Group aria-labelledby="list-{widgetId}-summary">
  {#if hasSubFields}
    <div class="toolbar top">
      <Button
        disabled={!items.length}
        iconName={parentExpanded ? 'expand_more' : 'chevron_right'}
        iconLabel={parentExpanded ? $_('collapse') : $_('expand')}
        aria-expanded={parentExpanded}
        aria-controls="list-{widgetId}-item-list"
        on:click={() => {
          parentExpanded = !parentExpanded;
        }}
      />
      <div class="summary" id="oblect-{widgetId}-summary">
        {`${items.length} ${items.length === 1 ? labelSingular || label : label}`}
      </div>
      <Spacer flex />
      {#if allowAdd && (addToTop || !items.length)}
        <Button
          class="secondary"
          disabled={max && items.length === max}
          iconName="add"
          label={$_('add_x', { values: { name: labelSingular || label } })}
          on:click={() => {
            addItem(true);
          }}
        />
      {/if}
    </div>
    <div class="item-list" id="list-{widgetId}-item-list" class:collapsed={!parentExpanded}>
      {#each items as item, index}
        <!-- @todo Support drag sorting. -->
        <div class="item">
          <div class="header">
            <Button
              iconName={itemExpandedList[index] ? 'expand_more' : 'chevron_right'}
              iconLabel={itemExpandedList[index] ? $_('collapse') : $_('expand')}
              aria-expanded={itemExpandedList[index]}
              aria-controls="list-{widgetId}-item-{index}-body"
              on:click={() => {
                itemExpandedList[index] = !itemExpandedList[index];
              }}
            />
            <Spacer flex={true} />
            <Button
              iconName="arrow_upward"
              iconLabel={$_('move_up')}
              disabled={index === 0}
              on:click={() => {
                moveUpItem(index);
              }}
            />
            <Spacer />
            <Button
              iconName="arrow_downward"
              iconLabel={$_('move_down')}
              disabled={index === items.length - 1}
              on:click={() => {
                moveDownItem(index);
              }}
            />
            <Spacer flex={true} />
            <Button
              iconName="close"
              iconLabel={$_('delete')}
              on:click={() => {
                deleteItem(index);
              }}
            />
          </div>
          <div class="item-body" id="list-{widgetId}-item-{index}-body">
            {#if itemExpandedList[index]}
              {#each fields || [field] as subField (subField.name)}
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
        <Button
          class="secondary"
          disabled={max && items.length === max}
          iconName="add"
          label={$_('add_x', { values: { name: labelSingular || label } })}
          on:click={() => {
            addItem();
          }}
        />
      </div>
    {/if}
  {:else}
    <TextInput {disabled} bind:value={inputValue} />
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

      :global(.icon) {
        font-size: 16px;
      }
    }

    .summary {
      padding: 8px;
    }
  }
</style>
