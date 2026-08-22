<script>
  import { _ } from '@sveltia/i18n';
  import { Button, ConfirmationDialog, MenuItem } from '@sveltia/ui';

  import { deleteAssets } from '$lib/services/assets/data/delete';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

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
  // Deleting a file from the media library commits straight to the configured branch rather than
  // going through review, so it’s not something an Open Authoring contributor can do
  const disabled = $derived(!assets.length || $openAuthoring);
</script>

<Component
  variant="ghost"
  {disabled}
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
  onOk={() => {
    deleteAssets(assets);
    onDelete?.();
  }}
>
  {dialogDescription}
</ConfirmationDialog>
