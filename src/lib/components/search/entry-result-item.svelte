<script>
  import { GridCell, GridRow } from '@sveltia/ui';
  import Image from '$lib/components/common/image.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { getCollectionsByEntry, getFilesByEntry } from '$lib/services/contents';
  import { getEntryThumbnail, getEntryTitle } from '$lib/services/contents/entry';

  /**
   * @type {Entry}
   */
  export let entry;

  $: ({ slug, locales } = entry);
  $: [collection] = getCollectionsByEntry(entry); // Use the first matching collection only
  $: [collectionFile] = getFilesByEntry(collection, entry); // Use the first matching file only
  $: ({ defaultLocale } = collection?._i18n ?? /** @type {I18nConfig} */ ({}));
  $: ({ content } = locales[defaultLocale] ?? Object.values(locales)[0] ?? {});
</script>

{#if content}
  <GridRow
    onclick={() => {
      goto(`/collections/${collection?.name}/entries/${collectionFile?.name || slug}`);
    }}
  >
    <GridCell class="image">
      {#await getEntryThumbnail(collection, entry) then src}
        {#if src}
          <Image {src} variant="icon" cover />
        {/if}
      {/await}
    </GridCell>
    <GridCell class="collection">
      {collection?.label || collection?.name}
    </GridCell>
    <GridCell class="title">
      {#if collectionFile}
        {collectionFile.label || collectionFile.name}
      {:else}
        {getEntryTitle(collection, entry)}
      {/if}
    </GridCell>
  </GridRow>
{/if}
