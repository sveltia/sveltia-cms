<script>
  import { Button, ConfirmationDialog } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { deleteAssets } from '$lib/services/assets/data';

  /**
   * @typedef {object} Props
   * @property {Asset[]} [assets] - Selected assets.
   * @property {string} [buttonDescription] - The `aria-label` attribute on the button.
   * @property {string} [dialogDescription] - Description to be displayed on the dialog.
   * @property {(() => void) | undefined} [onDelete] - Custom `delete` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    assets = [],
    buttonDescription = '',
    dialogDescription = '',
    onDelete = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  let showDialog = $state(false);
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
