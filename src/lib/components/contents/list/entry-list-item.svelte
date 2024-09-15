<script>
  import { Checkbox, GridCell, GridRow } from '@sveltia/ui';
  import Image from '$lib/components/common/image.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { getMediaFieldURL } from '$lib/services/assets';
  import { selectedCollection, selectedEntries } from '$lib/services/contents';
  import { formatSummary, listedEntries } from '$lib/services/contents/view';

  /**
   * @type {Entry}
   */
  export let entry;
  /**
   * @type {FlattenedEntryContent}
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
   * @type {string | undefined}
   */
  export let thumbnailFieldName;

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
        {formatSummary($selectedCollection, entry, locale)}
      {/if}
    </span>
  </GridCell>
</GridRow>
