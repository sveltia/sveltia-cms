<!--
  @component
  Implement the editor for the Object widget.
  @see https://decapcms.org/docs/widgets/#object
-->
<script>
  import { Button, Group, Icon, Spacer } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import {
    copyDefaultLocaleValues,
    createProxy,
    entryDraft,
    getDefaultValues,
  } from '$lib/services/contents/editor';
  import { getFieldDisplayValue } from '$lib/services/contents/entry';
  import { escapeRegExp, generateUUID } from '$lib/services/utils/strings';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {string}
   */
  export let keyPath;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldId;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldLabel;
  /**
   * @type {ObjectField}
   */
  export let fieldConfig;
  /**
   * @type {object}
   */
  // svelte-ignore unused-export-let
  export let currentValue;
  /**
   * @type {boolean}
   */
  // svelte-ignore unused-export-let
  export let readonly = false;
  /**
   * @type {boolean}
   */
  export let required = false;
  /**
   * @type {boolean}
   */
  // svelte-ignore unused-export-let
  export let invalid = false;

  $: ({
    name,
    label,
    i18n = false,
    // Widget-specific options
    collapsed = false,
    summary,
    fields,
  } = fieldConfig);

  $: ({
    collectionName,
    fileName,
    collection: {
      _i18n: { defaultLocale = 'default' },
    },
  } = $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: valueMap = $entryDraft.currentValues[locale];
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\b`);
  $: hasValues = Object.keys(valueMap).some((_keyPath) => _keyPath.match(keyPathRegex));
  $: listFormatter = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });
  $: parentExpanded = !collapsed;

  let widgetId = '';

  onMount(() => {
    widgetId = generateUUID().split('-').pop();
  });

  /**
   * Add the object’s subfields to the entry draft with the default values populated.
   */
  const addFields = () => {
    const newValueMap = copyDefaultLocaleValues(
      Object.fromEntries(
        Object.entries(getDefaultValues(fields)) //
          .map(([_keyPath, value]) => [`${keyPath}.${_keyPath}`, value]),
      ),
    );

    Object.keys($entryDraft.currentValues).forEach((_locale) => {
      if (_locale === locale || i18n === 'duplicate') {
        // Since we don’t want to trigger the Proxy’s i18n duplication strategy for descendant
        // fields, manually update the locale’s content and proxify the object again
        $entryDraft.currentValues[_locale] = createProxy({
          draft: $entryDraft,
          locale: _locale,
          target: { ...$entryDraft.currentValues[_locale], ...newValueMap },
        });
      }
    });
  };

  /**
   * Remove the object’s subfields from the entry draft.
   */
  const removeFields = () => {
    Object.entries($entryDraft.currentValues).forEach(([_locale, _valueMap]) => {
      if (_locale === locale || i18n === 'duplicate') {
        Object.keys(_valueMap).forEach((_keyPath) => {
          if (_keyPath.match(keyPathRegex)) {
            $entryDraft.currentValues[_locale][_keyPath] = null;
            delete $entryDraft.currentValues[_locale][_keyPath];
          }
        });
      }
    });
  };

  /**
   * Format the summary template.
   * @returns {string} Formatted summary.
   */
  const formatSummary = () => {
    if (!summary) {
      return valueMap[`${keyPath}.title`] ?? valueMap[`${keyPath}.name`] ?? '';
    }

    return summary.replaceAll(/{{fields\.(.+?)}}/g, (_match, _fieldName) => {
      const value = getFieldDisplayValue({
        collectionName,
        fileName,
        valueMap,
        keyPath: `${keyPath}.${_fieldName}`,
        locale,
      });

      return Array.isArray(value) ? listFormatter.format(value) : String(value);
    });
  };
</script>

{#if hasValues}
  <div role="none" class="wrapper">
    <Group aria-labelledby={parentExpanded ? undefined : `object-${widgetId}-summary`}>
      <div role="none" class="header">
        <Button
          size="small"
          iconic
          aria-label={parentExpanded ? $_('collapse') : $_('expand')}
          aria-expanded={parentExpanded}
          aria-controls="object-{widgetId}-item-list"
          on:click={() => {
            parentExpanded = !parentExpanded;
          }}
        >
          <Icon slot="start-icon" name={parentExpanded ? 'expand_more' : 'chevron_right'} />
        </Button>
        <Spacer flex />
        {#if !required}
          <Button
            size="small"
            iconic
            disabled={locale !== defaultLocale && i18n === 'duplicate'}
            aria-label={$_('remove_this_item')}
            on:click={() => {
              removeFields();
            }}
          >
            <Icon slot="start-icon" name="close" />
          </Button>
        {/if}
      </div>
      <div role="none" class="item-list" id="object-{widgetId}-item-list">
        {#if parentExpanded}
          {#each fields as subField (subField.name)}
            <FieldEditor
              keyPath={[keyPath, subField.name].join('.')}
              {locale}
              fieldConfig={subField}
            />
          {/each}
        {:else}
          <div role="none" class="summary" id="object-{widgetId}-summary">
            {formatSummary()}
          </div>
        {/if}
      </div>
    </Group>
  </div>
{:else if !required && (locale === defaultLocale || i18n !== false)}
  <Button
    variant="tertiary"
    label={$_('add_x', { values: { name: label || name } })}
    disabled={locale !== defaultLocale && i18n === 'duplicate'}
    on:click={() => {
      addFields();
    }}
  >
    <Icon slot="start-icon" name="add" />
  </Button>
{/if}

<style lang="scss">
  .wrapper {
    display: contents;

    & > :global(.group) {
      border-width: 2px;
      border-color: var(--sui-secondary-border-color);
      border-radius: var(--sui-control-medium-border-radius);
    }
  }

  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: var(--sui-secondary-border-color);

    :global(button) {
      height: 16px;
    }
  }

  .summary {
    overflow: hidden;
    padding: 8px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
