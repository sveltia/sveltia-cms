<!--
  @component
  Delete button with a confirmation dialog, shared by repository assets and assets on external
  locations. The caller provides the function that performs the deletion, and optionally one that
  works out what the deletion means for the entries using the assets, which the dialog then reports
  or, if a field would be left invalid, refuses the deletion over.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, ConfirmationDialog, MenuItem } from '@sveltia/ui';

  import CascadeDeleteNote from '$lib/components/common/cascade-delete-note.svelte';

  /**
   * @import { Asset, CascadeDeletePlan, ExternalAsset } from '$lib/types/private';
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
   * @property {(assets: any[]) => Promise<CascadeDeletePlan>} [planDeletion] Function that works
   * out what the deletion means for the entries using the assets. Deleting is held off until it
   * has answered, and refused if it reports a field that would be left invalid.
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
    planDeletion = undefined,
    buttonDescription = '',
    dialogDescription = '',
    onDelete = undefined,
    useButton = true,
    /* eslint-enable prefer-const */
  } = $props();

  let showDialog = $state(false);
  /**
   * Plan for the assets the dialog was opened for, or `undefined` while it’s being worked out.
   * @type {CascadeDeletePlan | undefined}
   */
  let plan = $state();

  const Component = $derived(useButton ? Button : MenuItem);
  const blocked = $derived(!!plan?.blockers.length);

  // Work out the plan whenever the dialog opens. The lookup is asynchronous — an asset without a
  // public path is matched by its blob URL, which may have to be created first — so the dialog
  // starts without a plan, and the Delete button waits for it
  $effect(() => {
    if (!showDialog || !planDeletion) {
      return;
    }

    const selection = assets;

    plan = undefined;

    planDeletion(selection).then((result) => {
      // The dialog may have been reopened for another selection meanwhile
      if (showDialog && assets === selection) {
        plan = result;
      }
    });
  });
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
  okDisabled={!!planDeletion && (!plan || blocked)}
  onOk={async () => {
    if ((await deleteAssets(assets)) !== false) {
      onDelete?.();
    }
  }}
>
  <!-- There’s nothing to confirm when the deletion is refused; the note explains why -->
  {#if !blocked}
    {dialogDescription}
  {/if}
  {#if plan}
    <CascadeDeleteNote {plan} kind="asset" count={assets.length} />
  {/if}
</ConfirmationDialog>
