<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { canCreateAsset, selectedAssetFolder } from '$lib/services/assets';
  import { showUploadAssetsDialog } from '$lib/services/assets/view';

  /**
   * @typedef {object} Props
   * @property {string} [label] Button label. If `undefined`, the button will be iconic.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    label = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const disabled = $derived(!canCreateAsset($selectedAssetFolder));
</script>

<Button
  variant="primary"
  iconic={!label}
  {disabled}
  {label}
  aria-label={$_('upload_assets')}
  onclick={() => {
    $showUploadAssetsDialog = true;
  }}
>
  {#snippet startIcon()}
    <Icon name="cloud_upload" />
  {/snippet}
</Button>
