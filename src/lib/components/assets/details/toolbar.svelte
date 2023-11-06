<script>
  import { Button, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import DeleteAssetsDialog from '$lib/components/assets/shared/delete-assets-dialog.svelte';
  import { selectedAsset, selectedAssetFolderPath } from '$lib/services/assets';
  import { goBack } from '$lib/services/navigation';

  let showDeleteDialog = false;
</script>

<Toolbar variant="primary" aria-label={$_('asset_editor_toolbar')}>
  <Button
    variant="ghost"
    iconic
    on:click={() => {
      goBack($selectedAssetFolderPath ? `/assets/${$selectedAssetFolderPath}` : '/assets');
    }}
  >
    <Icon slot="start-icon" name="arrow_back_ios_new" label={$_('cancel_editing')} />
  </Button>
  <h2>{$selectedAsset.name}</h2>
  <Spacer flex />
  <!-- @todo Implement these actions.
  <Button variant="secondary" label={$_('edit')} />
  <Button variant="secondary" label={$_('replace')} />
  -->
  <Button
    variant="secondary"
    label={$_('delete')}
    on:click={() => {
      showDeleteDialog = true;
    }}
  >
    <Icon slot="start-icon" name="delete" />
  </Button>
</Toolbar>

<DeleteAssetsDialog
  bind:open={showDeleteDialog}
  assets={[$selectedAsset]}
  on:delete={() => {
    goBack($selectedAssetFolderPath ? `/assets/${$selectedAssetFolderPath}` : '/assets');
  }}
/>
