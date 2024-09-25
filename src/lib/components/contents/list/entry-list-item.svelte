<script>
  import { Checkbox, GridCell, GridRow } from '@sveltia/ui';
  import { waitForVisibility } from '@sveltia/utils/element';
  import Image from '$lib/components/common/image.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { getMediaFieldURL } from '$lib/services/assets';
  import { selectedCollection, selectedEntries } from '$lib/services/contents';
  import { formatEntryTitle, listedEntries } from '$lib/services/contents/view';

  /**
   * @type {Entry}
   */
  export let entry;
  /**
   * @type {FlattenedEntryContent}
   */
  export let content;
  /**
   * @type {ViewType}
   */
  export let viewType;
  /**
   * @type {string | undefined}
   */
  export let thumbnailFieldName;

  /**
   * @type {HTMLElement | undefined}
   */
  let wrapper;

  /**
   * @type {string | undefined}
   */
  let src;

  $: (async () => {
    src =
      content && thumbnailFieldName
        ? await getMediaFieldURL(content[thumbnailFieldName], entry, { thumbnail: true })
        : undefined;
  })();

  /**
   * Update the entry selection.
   * @param {boolean} selected - Whether the current entry item is selected.
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
  onChange={(event) => {
    updateSelection(/** @type {CustomEvent} */ (event).detail.selected);
  }}
  onclick={() => {
    goto(`/collections/${$selectedCollection?.name}/entries/${entry.slug}`);
  }}
>
  <div role="none" class="wrapper" bind:this={wrapper}>
    {#if wrapper?.parentElement}
      {#await waitForVisibility(wrapper.parentElement) then}
        <GridCell class="checkbox">
          <Checkbox
            role="none"
            tabindex="-1"
            checked={$selectedEntries.includes(entry)}
            onChange={({ detail: { checked } }) => {
              updateSelection(checked);
            }}
          />
        </GridCell>
        {#if thumbnailFieldName}
          <GridCell class="image">
            {#if src}
              <Image {src} variant={viewType === 'list' ? 'icon' : 'tile'} cover />
            {/if}
          </GridCell>
        {/if}
        <GridCell class="title">
          <span role="none">
            {#if $selectedCollection}
              {formatEntryTitle($selectedCollection, entry)}
            {/if}
          </span>
        </GridCell>
      {/await}
    {/if}
  </div>
</GridRow>

<style lang="scss">
  .wrapper {
    display: contents;
  }
</style>
