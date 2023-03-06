<script>
  import { Button, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import DeleteAssetsDialog from '$lib/components/assets/shared/delete-assets-dialog.svelte';
  import { selectedAsset, selectedAssetFolderPath } from '$lib/services/assets';
  import { goBack } from '$lib/services/navigation';

  let showDeleteDialog = false;
</script>

<Toolbar class="primary">
  <Button
    class="ternary iconic"
    iconName="arrow_back_ios_new"
    iconLabel={$_('cancel')}
    on:click={() => {
      goBack($selectedAssetFolderPath ? `/assets/${$selectedAssetFolderPath}` : '/assets');
    }}
  />
  <h2>{$selectedAsset.name}</h2>
  <Spacer flex={true} />
  <!-- @todo Implement these actions.
  <Button class="secondary" label={$_('edit')} />
  <Button class="secondary" label={$_('replace')} />
  -->
  <Button
    class="secondary"
    iconName="delete"
    label={$_('delete')}
    on:click={() => {
      showDeleteDialog = true;
    }}
  />
</Toolbar>

<DeleteAssetsDialog
  bind:open={showDeleteDialog}
  assets={[$selectedAsset]}
  on:delete={() => {
    goBack($selectedAssetFolderPath ? `/assets/${$selectedAssetFolderPath}` : '/assets');
  }}
/>
