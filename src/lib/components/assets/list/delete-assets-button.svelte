<!--
  @component
  Delete button with a confirmation dialog, shared by repository assets and assets on external
  locations. The caller provides the function that performs the deletion.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, ConfirmationDialog, MenuItem } from '@sveltia/ui';

  /**
   * @import { Asset, ExternalAsset } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {(Asset | ExternalAsset)[]} [assets] Selected assets.
   * @property {boolean} [disabled] Whether deleting is not possible for the location, regardless
   * of the selection.
   * @property {(assets: any[]) => Promise<boolean | void> | void} deleteAssets Function that
   * deletes the assets. `onDelete` is called once it returns, unless it resolves with `false`, so
   * a function that starts the deletion without returning its promise lets the caller move on
   * right away.
   * @property {string} [buttonDescription] The `aria-label` attribute on the button.
   * @property {string} [dialogDescription] Description to be displayed on the dialog.
   * @property {(() => void) | undefined} [onDelete] Called once the assets have been deleted.
   * @property {boolean} [useButton] Whether to use the Button component.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    assets = [],
    disabled = false,
    deleteAssets,
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
  disabled={disabled || !assets.length}
  label={_('delete')}
  aria-label={buttonDescription}
  onclick={() => {
    showDialog = true;
  }}
/>

<ConfirmationDialog
  bind:open={showDialog}
  title={_('delete_assets', { values: { count: assets.length } })}
  okLabel={_('delete')}
  onOk={async () => {
    if ((await deleteAssets(assets)) !== false) {
      onDelete?.();
    }
  }}
>
  {dialogDescription}
</ConfirmationDialog>
