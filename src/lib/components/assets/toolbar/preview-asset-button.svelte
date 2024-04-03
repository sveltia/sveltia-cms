<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { canPreviewAsset } from '$lib/services/assets';
  import { goto } from '$lib/services/navigation';

  /**
   * @type {Asset | undefined}
   */
  export let asset;
</script>

<Button
  variant="ghost"
  disabled={!asset || !canPreviewAsset(asset)}
  label={$_('preview')}
  aria-label={$_('show_preview')}
  on:click={() => {
    goto(`/assets/${asset?.path}`);
  }}
>
  <Icon slot="start-icon" name="fullscreen" />
</Button>
