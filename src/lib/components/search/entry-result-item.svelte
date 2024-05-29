<script>
  import { GridCell, GridRow } from '@sveltia/ui';
  import Image from '$lib/components/common/image.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { getMediaFieldURL } from '$lib/services/assets';
  import { getCollection } from '$lib/services/contents';

  /**
   * @type {Entry}
   */
  export let entry;

  /**
   * @type {string | undefined}
   */
  let src;

  $: ({ slug, locales, fileName, collectionName } = entry);
  $: collection = getCollection(collectionName);
  $: collectionFile = fileName ? collection?._fileMap?.[fileName] : undefined;
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
    on:click={() => {
      goto(`/collections/${collectionName}/entries/${fileName || slug}`);
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
      {:else if content}
        {content[collection?.identifier_field ?? ''] ||
          content.title ||
          content.name ||
          content.label}
      {/if}
    </GridCell>
  </GridRow>
{/if}
