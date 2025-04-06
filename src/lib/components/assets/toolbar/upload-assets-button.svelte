<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { isSmallScreen } from '$lib/services/app/env';
  import { selectedAssetFolder } from '$lib/services/assets';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';

  // Can’t upload assets if collection assets are saved at entry-relative paths
  const uploadDisabled = $derived(!!$selectedAssetFolder?.entryRelative);
</script>

<Button
  variant="primary"
  disabled={uploadDisabled}
  iconic={$isSmallScreen}
  label={$isSmallScreen ? undefined : $_('upload')}
  aria-label={$_('upload_assets')}
  onclick={() => {
    $showUploadAssetsDialog = true;
  }}
>
  {#snippet startIcon()}
    <Icon name="cloud_upload" />
  {/snippet}
</Button>
