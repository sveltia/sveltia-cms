<script>
  import { Button, ConfirmationDialog, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { deleteAssets } from '$lib/services/assets/data/delete';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Asset[]} [assets] Selected assets.
   * @property {string} [buttonDescription] The `aria-label` attribute on the button.
   * @property {string} [dialogDescription] Description to be displayed on the dialog.
   * @property {(() => void) | undefined} [onDelete] Custom `delete` event handler.
   * @property {boolean} [useButton] Whether to use the Button component.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    assets = [],
    buttonDescription = '',
    dialogDescription = '',
    onDelete = undefined,
    useButton = true,
    /* eslint-enable prefer-const */
  } = $props();

  let showDialog = $state(false);

  const Component = $derived(useButton ? Button : MenuItem);
</script>

<Component
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
