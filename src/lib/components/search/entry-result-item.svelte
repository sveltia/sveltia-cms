<script>
  import { GridCell, GridRow } from '@sveltia/ui';
  import Image from '$lib/components/common/image.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { getFilesByEntry } from '$lib/services/contents/collection/files';
  import { getAssociatedCollections } from '$lib/services/contents/entry';
  import { getEntryThumbnail } from '$lib/services/contents/entry/assets';
  import { getEntrySummary } from '$lib/services/contents/entry/summary';
  import { defaultI18nConfig } from '$lib/services/contents/i18n';

  /**
   * @typedef {object} Props
   * @property {Entry} entry - Single entry.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    entry,
    /* eslint-enable prefer-const */
  } = $props();

  const { locales, subPath } = $derived(entry);
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
        goto(`/collections/${collection?.name}/entries/${collectionFile?.name || subPath}`);
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
          {@html getEntrySummary(collection, entry, { useTemplate: true, allowMarkdown: true })}
        {/if}
      </GridCell>
    </GridRow>
  {/if}
{/snippet}

{#each getAssociatedCollections(entry) as collection (collection.name)}
  {#each getFilesByEntry(collection, entry) as collectionFile (collectionFile.name)}
    {@render resultRow({ collection, collectionFile })}
  {:else}
    {@render resultRow({ collection })}
  {/each}
{/each}
