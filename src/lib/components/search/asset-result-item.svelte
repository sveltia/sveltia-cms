<script>
  import { GridCell, GridRow, TruncatedText } from '@sveltia/ui';
  import { locale as appLocale } from 'svelte-i18n';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { getFolderLabelByPath } from '$lib/services/assets/view';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset} asset Single asset.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    asset,
    /* eslint-enable prefer-const */
  } = $props();

  const { path, name, folder, kind } = $derived(asset);
</script>

<GridRow
  onclick={() => {
    goto(`/assets/${path}`, { transitionType: 'forwards' });
  }}
>
  <GridCell class="image">
    <AssetPreview {kind} {asset} variant="icon" cover />
  </GridCell>
  <GridCell class="collection">
    {#key $appLocale}
      {getFolderLabelByPath(folder)}
    {/key}
  </GridCell>
  <GridCell class="title">
    <div role="none" class="label">
      <TruncatedText lines={2}>
        {name}
      </TruncatedText>
    </div>
  </GridCell>
</GridRow>
