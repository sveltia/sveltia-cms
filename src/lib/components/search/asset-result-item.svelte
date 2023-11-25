<script>
  import { GridCell, GridRow } from '@sveltia/ui';
  import { locale as appLocale } from 'svelte-i18n';
  import Image from '$lib/components/common/image.svelte';
  import Video from '$lib/components/common/video.svelte';
  import { getFolderLabelByPath } from '$lib/services/assets/view';
  import { goto } from '$lib/services/navigation';

  /**
   * @type {Asset}
   */
  export let asset;

  $: ({ path, name, folder, kind } = asset);
</script>

<GridRow
  on:click={() => {
    goto(`/assets/${path}`);
  }}
>
  <GridCell class="image">
    {#if kind === 'image'}
      <Image {asset} variant="icon" cover />
    {/if}
    {#if kind === 'video'}
      <Video {asset} variant="icon" cover />
    {/if}
  </GridCell>
  <GridCell class="collection">
    {$appLocale ? getFolderLabelByPath(folder) : ''}
  </GridCell>
  <GridCell class="title">
    {name}
  </GridCell>
</GridRow>
