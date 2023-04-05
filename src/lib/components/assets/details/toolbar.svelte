<script>
  import { Button, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import DeleteAssetsDialog from '$lib/components/assets/shared/delete-assets-dialog.svelte';
  import { selectedAsset, selectedAssetFolderPath } from '$lib/services/assets';
  import { goBack } from '$lib/services/navigation';

  let showDeleteDialog = false;
</script>

<Toolbar class="primary">
  <Button
    class="ternary iconic"
    on:click={() => {
      goBack($selectedAssetFolderPath ? `/assets/${$selectedAssetFolderPath}` : '/assets');
    }}
  >
    <Icon slot="start-icon" name="arrow_back_ios_new" label={$_('cancel')} />
  </Button>
  <h2>{$selectedAsset.name}</h2>
  <Spacer flex={true} />
  <!-- @todo Implement these actions.
  <Button class="secondary" label={$_('edit')} />
  <Button class="secondary" label={$_('replace')} />
  -->
  <Button
    class="secondary"
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
