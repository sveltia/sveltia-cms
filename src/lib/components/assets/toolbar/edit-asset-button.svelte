<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { canEditAsset, editingAsset } from '$lib/services/assets';

  /**
   * @type {Asset | undefined}
   */
  export let asset;
</script>

<Button
  variant="ghost"
  disabled={!asset || !canEditAsset(asset)}
  label={$_('edit')}
  on:click={() => {
    $editingAsset = asset;
  }}
>
  <Icon slot="start-icon" name="edit" />
</Button>
