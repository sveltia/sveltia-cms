<script>
  import { GridCell, GridRow } from '@sveltia/ui';
  import Image from '$lib/components/common/image.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { getCollectionsByEntry } from '$lib/services/contents/collection';
  import { getFilesByEntry } from '$lib/services/contents/collection/files';
  import { getEntryThumbnail, getEntryTitle } from '$lib/services/contents/entry';
  import { defaultI18nConfig } from '$lib/services/contents/i18n';

  /**
   * @type {Entry}
   */
  export let entry;

  $: ({ slug, locales } = entry);
</script>

{#snippet resultRow(
  /** @type {{ collection: Collection, collectionFile?: CollectionFile }} */ {
    collection,
    collectionFile,
  },
)}
  {@const { defaultLocale } = (collectionFile ?? collection)?._i18n ?? defaultI18nConfig}
  {@const { content } = locales[defaultLocale] ?? Object.values(locales)[0] ?? {}}
  {#if content}
    <GridRow
      onclick={() => {
        goto(`/collections/${collection?.name}/entries/${collectionFile?.name || slug}`);
      }}
    >
      <GridCell class="image">
        {#if collection._type === 'entry'}
          {#await getEntryThumbnail(/** @type {EntryCollection} */ (collection), entry) then src}
            {#if src}
              <Image {src} variant="icon" cover />
            {/if}
          {/await}
        {/if}
      </GridCell>
      <GridCell class="collection">
        {collection?.label || collection?.name}
      </GridCell>
      <GridCell class="title">
        {#if collectionFile}
          {collectionFile.label || collectionFile.name}
        {:else}
          {@html getEntryTitle(collection, entry, { useTemplate: true, allowMarkdown: true })}
        {/if}
      </GridCell>
    </GridRow>
  {/if}
{/snippet}

{#each getCollectionsByEntry(entry) as collection (collection.name)}
  {#each getFilesByEntry(collection, entry) as collectionFile (collectionFile.name)}
    {@render resultRow({ collection, collectionFile })}
  {:else}
    {@render resultRow({ collection })}
  {/each}
{/each}
