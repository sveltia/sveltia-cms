<script>
  import { Button } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { uploadingAssets } from '$lib/services/assets';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';

  /**
   * @type {Asset | undefined}
   */
  export let asset;
</script>

<Button
  variant="ghost"
  label={$_('replace')}
  disabled={!asset}
  aria-label={$_('replace_asset')}
  on:click={() => {
    $uploadingAssets = { folder: undefined, files: [], originalAsset: asset };
    $showUploadAssetsDialog = true;
  }}
/>
