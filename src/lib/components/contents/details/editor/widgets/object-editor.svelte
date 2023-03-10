<!--
  @component
  Implement the editor for the Object widget.
  @see https://www.netlifycms.org/docs/widgets/#object
-->
<script>
  import { Button, Group, Spacer } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { entryDraft } from '$lib/services/contents/editor';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';

  export let locale = '';
  export let keyPath = '';
  export let fieldConfig = {};
  // svelte-ignore unused-export-let
  export let currentValue = undefined;

  $: ({
    // Widget-specific options
    collapsed = false,
    summary,
    fields,
  } = fieldConfig);

  $: keyValueMap = $entryDraft.currentValues[locale];
  $: parentExpanded = !collapsed;

  let widgetId;

  onMount(() => {
    widgetId = window.crypto.randomUUID().split('-').pop();
  });
</script>

<Group aria-labelledby="oblect-{widgetId}-summary">
  <div class="toolbar top">
    <Button
      iconName={parentExpanded ? 'expand_more' : 'chevron_right'}
      iconLabel={parentExpanded ? $_('collapse') : $_('expand')}
      aria-expanded={parentExpanded}
      aria-controls="oblect-{widgetId}-item-list"
      on:click={() => {
        parentExpanded = !parentExpanded;
      }}
    />
    <div class="summary" id="oblect-{widgetId}-summary">
      {#if summary}
        {summary.replaceAll(
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
      font-size: 12px;
      font-weight: 600;
      color: var(--secondary-foreground-color);
    }
  }

  .item-list {
    &.collapsed {
      display: none;
    }
  }
</style>
