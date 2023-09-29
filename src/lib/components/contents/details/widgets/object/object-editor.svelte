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
  import { generateUUID } from '$lib/services/utils/strings';

  export let locale = '';

  export let keyPath = '';

  /**
   * @type {ObjectField}
   */
  export let fieldConfig = undefined;

  /**
   * @type {object}
   */
  // svelte-ignore unused-export-let
  export let currentValue = undefined;

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

  $: keyValueMap = $entryDraft.currentValues[locale];
  $: parentExpanded = !collapsed;

  let widgetId = '';

  onMount(() => {
    widgetId = generateUUID().split('-').pop();
  });
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
    <div class="summary" id="oblect-{widgetId}-summary">
      {#if summary}
        {summary.replaceAll(
          // @todo Resolve relation fields
          /{{fields\.(.+?)}}/g,
          (_match, _keyPath) => `${keyValueMap[`${keyPath}.${_keyPath}`] || ''}`,
        )}
      {:else}
        {keyValueMap[`${keyPath}.title`] || keyValueMap[`${keyPath}.name`] || ''}
      {/if}
    </div>
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
