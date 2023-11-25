<script>
  import { Checkbox, GridCell, GridRow } from '@sveltia/ui';
  import Image from '$lib/components/common/image.svelte';
  import { getMediaFieldURL } from '$lib/services/assets';
  import { selectedCollection, selectedEntries } from '$lib/services/contents';
  import { formatSummary, listedEntries } from '$lib/services/contents/view';
  import { goto } from '$lib/services/navigation';

  /**
   * @type {Entry}
   */
  export let entry;
  /**
   * @type {EntryContent}
   */
  export let content;
  /**
   * @type {string}
   */
  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {ViewType}
   */
  export let viewType;

  /**
   * @type {string}
   */
  let src;

  $: firstImageField = $selectedCollection.fields?.find(({ widget }) => widget === 'image');

  $: (async () => {
    src =
      content && firstImageField
        ? await getMediaFieldURL(content[firstImageField.name], entry)
        : undefined;
  })();

  /**
   * Update the entry selection.
   * @param {boolean} selected Whether the current entry item is selected.
   */
  const updateSelection = (selected) => {
    selectedEntries.update((entries) => {
      const index = entries.indexOf(entry);

      if (selected && index === -1) {
        entries.push(entry);
      }

      if (!selected && index > -1) {
        entries.splice(index, 1);
      }

      return entries;
    });
  };
</script>

<GridRow
  aria-rowindex={$listedEntries.indexOf(entry)}
  on:change={(/** @type {CustomEvent} */ { detail: { selected } }) => {
    updateSelection(selected);
  }}
  on:click={() => {
    goto(`/collections/${$selectedCollection.name}/entries/${entry.slug}`);
  }}
>
  <GridCell class="checkbox">
    <Checkbox
      role="none"
      tabindex="-1"
      checked={$selectedEntries.includes(entry)}
      on:change={({ detail: { checked } }) => {
        updateSelection(checked);
      }}
    />
  </GridCell>
  {#if firstImageField}
    <GridCell class="image">
      {#if src}
        <Image {src} variant={viewType === 'list' ? 'icon' : 'tile'} cover />
      {/if}
    </GridCell>
  {/if}
  <GridCell class="title">
    <span role="none">
      {formatSummary($selectedCollection, entry, locale)}
    </span>
  </GridCell>
</GridRow>
