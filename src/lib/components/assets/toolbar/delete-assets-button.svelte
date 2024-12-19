<script>
  import { Button, ConfirmationDialog } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { deleteAssets } from '$lib/services/assets/data';

  /**
   * @type {Asset[]}
   */
  export let assets = [];
  /**
   * @type {string}
   */
  export let buttonDescription = '';
  /**
   * @type {string}
   */
  export let dialogDescription = '';
  /**
   * Custom `delete` event handler.
   * @type {(() => void) | undefined}
   */
  export let onDelete = undefined;

  let showDialog = false;
</script>

<Button
  variant="ghost"
  disabled={!assets.length}
  label={$_('delete')}
  aria-label={buttonDescription}
  onclick={() => {
    showDialog = true;
  }}
/>

<ConfirmationDialog
  bind:open={showDialog}
  title={assets.length === 1 ? $_('delete_asset') : $_('delete_assets')}
  okLabel={$_('delete')}
  onOk={() => {
    deleteAssets(assets);
    onDelete?.();
  }}
>
  {dialogDescription}
</ConfirmationDialog>
