<script>
  import { Button, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import DeleteAssetsDialog from '$lib/components/assets/shared/delete-assets-dialog.svelte';
  import { overlaidAsset, selectedAssetFolderPath } from '$lib/services/assets';
  import { goBack } from '$lib/services/navigation';

  let showDeleteDialog = false;
</script>

<Toolbar variant="primary" aria-label={$_('primary')}>
  <Button
    variant="ghost"
    iconic
    aria-label={$_('cancel_editing')}
    on:click={() => {
      goBack($selectedAssetFolderPath ? `/assets/${$selectedAssetFolderPath}` : '/assets');
    }}
  >
    <Icon slot="start-icon" name="arrow_back_ios_new" />
  </Button>
  <h2 role="none">{$overlaidAsset.name}</h2>
  <Spacer flex />
  <!-- @todo Implement these actions.
  <Button variant="secondary" label={$_('edit')} aria-label={$_('edit_file')} />
  <Button variant="secondary" label={$_('replace')} aria-label={$_('replace_file')} />
  -->
  <Button
    variant="secondary"
    label={$_('delete')}
    aria-label={$_('delete_asset')}
    on:click={() => {
      showDeleteDialog = true;
    }}
  >
    <Icon slot="start-icon" name="delete" />
  </Button>
</Toolbar>

<DeleteAssetsDialog
  bind:open={showDeleteDialog}
  description={$_('confirm_deleting_this_asset')}
  assets={[$overlaidAsset]}
  on:delete={() => {
    goBack($selectedAssetFolderPath ? `/assets/${$selectedAssetFolderPath}` : '/assets');
  }}
/>
