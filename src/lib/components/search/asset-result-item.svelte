<script>
  import { GridCell, GridRow } from '@sveltia/ui';
  import { locale as appLocale } from 'svelte-i18n';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
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
    <AssetPreview {kind} {asset} variant="icon" cover />
  </GridCell>
  <GridCell class="collection">
    {$appLocale ? getFolderLabelByPath(folder) : ''}
  </GridCell>
  <GridCell class="title">
    {name}
  </GridCell>
</GridRow>
