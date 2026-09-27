<!--
  @component
  Thumbnail of an entry, as shown in the entry list, the search results and the Editorial Workflow
  page. Nothing is rendered for an entry without one. The thumbnail’s object URL is released when
  the entry changes or the thumbnail is removed, so a long list doesn’t keep every thumbnail it has
  ever shown in memory.
-->
<script>
  import Image from '$lib/components/assets/shared/image.svelte';
  import { loadEntryThumbnail } from '$lib/services/contents/entry/assets';

  /**
   * @import { Entry, InternalEntryCollection } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalEntryCollection} collection Entry’s collection.
   * @property {Entry} entry Entry.
   * @property {'icon' | 'tile'} variant Image variant.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    collection,
    entry,
    variant,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {string | undefined} */
  let src = $state();

  $effect(() =>
    loadEntryThumbnail(collection, entry, (url) => {
      src = url;
    }),
  );
</script>

{#if src}
  <Image {src} {variant} cover />
{/if}
