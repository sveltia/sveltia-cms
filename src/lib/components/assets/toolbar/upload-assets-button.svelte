<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { selectedAssetFolder } from '$lib/services/assets';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';

  // Can’t upload assets if collection assets are saved at entry-relative paths
  const uploadDisabled = $derived(!!$selectedAssetFolder?.entryRelative);
</script>

<Button
  variant="primary"
  label={$_('upload')}
  disabled={uploadDisabled}
  aria-label={$_('upload_assets')}
  onclick={() => {
    $showUploadAssetsDialog = true;
  }}
>
  {#snippet startIcon()}
    <Icon name="cloud_upload" />
  {/snippet}
</Button>
