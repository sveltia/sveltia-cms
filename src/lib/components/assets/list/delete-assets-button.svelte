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
  import { tick } from 'svelte';

  import CascadeDeleteNote from '$lib/components/common/cascade-delete-note.svelte';
  import { focusList } from '$lib/services/app/focus';

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
   * @property {number} [listedCount] Number of the assets listed in the view, given when the button
   * deletes the selected assets, which may be all of them, rather than the asset shown in the
   * details overlay. The button and the dialog describe the deletion accordingly.
   * @property {(() => void) | undefined} [onDelete] Called once the assets have been deleted.
   * @property {boolean} [useButton] Whether to use the Button component.
   */

  /** @type {Props} */
  let {
    assets = [],
    disabled = false,
    deleteAssets,
    planDeletion = undefined,
    listedCount = undefined,
    onDelete = undefined,
    useButton = true,
  } = $props();

  let showDialog = $state(false);
  /**
   * Plan for the assets the dialog was opened for, or `undefined` while it’s being worked out.
   * @type {CascadeDeletePlan | undefined}
   */
  let plan = $state();
  /** Whether the plan couldn’t be worked out, which leaves nothing to delete the assets with. */
  let planFailed = $state(false);
  /** @type {HTMLButtonElement | undefined} */
  let button = $state();

  const count = $derived(assets.length);
  const buttonDescription = $derived(
    listedCount === undefined
      ? _('delete_assets', { values: { count: 1 } })
      : _('delete_selected_assets', { values: { count } }),
  );
  const dialogDescription = $derived(
    listedCount === undefined
      ? _('confirm_deleting_this_asset')
      : _(
          count > 1 && count === listedCount
            ? 'confirm_deleting_all_assets'
            : 'confirm_deleting_selected_assets',
          { values: { count } },
        ),
  );
  const buttonDisabled = $derived(disabled || !count);
  const blocked = $derived(!!plan?.blockers.length);

  // Work out the plan whenever the dialog opens. The lookup is asynchronous, so the dialog starts
  // without a plan, and the Delete button waits for it. The deletion then reuses the plan, unless
  // the entries have changed in the meantime
  $effect(() => {
    if (!showDialog || !planDeletion) {
      return;
    }

    const selection = assets;

    plan = undefined;
    planFailed = false;

    planDeletion(selection).then(
      (result) => {
        // The dialog may have been reopened for another selection meanwhile
        if (showDialog && assets === selection) {
          plan = result;
        }
      },
      (/** @type {any} */ ex) => {
        // eslint-disable-next-line no-console
        console.error(ex);

        // Say why the assets can’t be deleted. A failed plan isn’t kept, so it’s worked out again
        // once the dialog is reopened
        if (showDialog && assets === selection) {
          planFailed = true;
        }
      },
    );
  });

  // The Delete button is disabled once the selected assets are deleted, which would drop its focus
  // on `<body>`, so move it to the asset list. This runs before the button is updated, while it
  // still has the focus
  $effect.pre(() => {
    if (buttonDisabled && document.activeElement === button) {
      tick().then(() => focusList());
    }
  });
</script>

{#if useButton}
  <Button
    bind:element={button}
    variant="ghost"
    disabled={buttonDisabled}
    label={_('delete')}
    aria-label={buttonDescription}
    onclick={() => {
      showDialog = true;
    }}
  />
{:else}
  <MenuItem
    variant="ghost"
    disabled={buttonDisabled}
    label={_('delete')}
    aria-label={buttonDescription}
    onclick={() => {
      showDialog = true;
    }}
  />
{/if}

<ConfirmationDialog
  bind:open={showDialog}
  title={_('delete_assets', { values: { count } })}
  okLabel={_('delete')}
  okDisabled={!!planDeletion && (!plan || blocked)}
  onOk={async () => {
    if ((await deleteAssets(assets)) !== false) {
      onDelete?.();
    }
  }}
>
  <!-- There’s nothing to confirm when the deletion is refused or can’t go ahead; the note or the
  error explains why -->
  {#if planFailed}
    <div role="alert">
      {_('checking_asset_references_failed', { values: { count } })}
    </div>
  {:else if !blocked}
    {dialogDescription}
  {/if}
  {#if plan}
    <CascadeDeleteNote {plan} kind="asset" {count} />
  {/if}
</ConfirmationDialog>
