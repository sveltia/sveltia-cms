<script>
  import { Button } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { goto } from '$lib/services/app/navigation';
  import { canPreviewAsset } from '$lib/services/assets';

  /**
   * @typedef {object} Props
   * @property {Asset} [asset] - Selected asset.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    asset,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<Button
  variant="ghost"
  disabled={!asset || !canPreviewAsset(asset)}
  label={$_('preview')}
  aria-label={$_('show_preview')}
  onclick={() => {
    goto(`/assets/${asset?.path}`);
  }}
/>
