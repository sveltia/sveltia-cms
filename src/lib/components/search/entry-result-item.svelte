<script>
  import { GridCell, GridRow } from '@sveltia/ui';
  import Image from '$lib/components/common/image.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { getMediaFieldURL } from '$lib/services/assets';
  import { getCollectionsByEntry, getFilesByEntry } from '$lib/services/contents';
  import { formatEntryTitle } from '$lib/services/contents/view';

  /**
   * @type {Entry}
   */
  export let entry;

  /**
   * @type {string | undefined}
   */
  let src;

  $: ({ slug, locales } = entry);
  $: [collection] = getCollectionsByEntry(entry); // Use the first matching collection only
  $: [collectionFile] = getFilesByEntry(collection, entry); // Use the first matching file only
  $: ({ defaultLocale } = collection?._i18n ?? /** @type {I18nConfig} */ ({}));
  $: locale = defaultLocale in locales ? defaultLocale : Object.keys(locales)[0];
  $: ({ content } = locales[locale] ?? {});
  $: thumbnailFieldName = collection?._thumbnailFieldName;

  $: (async () => {
    src =
      content && thumbnailFieldName
        ? await getMediaFieldURL(content[thumbnailFieldName], entry, { thumbnail: true })
        : undefined;
  })();
</script>

{#if content}
  <GridRow
    onclick={() => {
      goto(`/collections/${collection?.name}/entries/${collectionFile?.name || slug}`);
    }}
  >
    <GridCell class="image">
      {#if src}
        <Image {src} variant="icon" cover />
      {/if}
    </GridCell>
    <GridCell class="collection">
      {collection?.label || collection?.name}
    </GridCell>
    <GridCell class="title">
      {#if collectionFile}
        {collectionFile.label || collectionFile.name}
      {:else}
        {formatEntryTitle(collection, entry, { useTemplate: false })}
      {/if}
    </GridCell>
  </GridRow>
{/if}
