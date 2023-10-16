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
  import { entryDraft } from '$lib/services/contents/editor';
  import { getFieldDisplayValue } from '$lib/services/contents/entry';
  import { generateUUID } from '$lib/services/utils/strings';

  export let locale = '';

  export let keyPath = '';

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
  export let disabled = false;

  $: ({
    // Widget-specific options
    collapsed = false,
    summary,
    fields,
  } = fieldConfig);

  $: ({ collectionName, fileName } = $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: valueMap = $entryDraft.currentValues[locale];
  $: listFormatter = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });
  $: parentExpanded = !collapsed;

  let widgetId = '';

  onMount(() => {
    widgetId = generateUUID().split('-').pop();
  });

  /**
   * Format the summary template.
   * @returns {string} Formatted summary.
   */
  const formatSummary = () => {
    if (!summary) {
      return valueMap[`${keyPath}.title`] || valueMap[`${keyPath}.name`] || '';
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

<Group aria-labelledby="oblect-{widgetId}-summary">
  <div class="toolbar top">
    <Button
      aria-expanded={parentExpanded}
      aria-controls="oblect-{widgetId}-item-list"
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
    {#if !parentExpanded}
      <div class="summary" id="oblect-{widgetId}-summary">
        {formatSummary()}
      </div>
    {/if}
    <Spacer flex />
  </div>
  <div class="item-list" id="oblect-{widgetId}-item-list" class:collapsed={!parentExpanded}>
    {#each fields as subField (subField.name)}
      <FieldEditor keyPath={[keyPath, subField.name].join('.')} {locale} fieldConfig={subField} />
    {/each}
  </div>
</Group>

<style lang="scss">
  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px;

    .summary {
      overflow: hidden;
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-small);
      font-weight: 600;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  }

  .item-list {
    &.collapsed {
      display: none;
    }
  }
</style>
