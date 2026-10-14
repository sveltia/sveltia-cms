<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Dialog, Switch, TextArea, Toast } from '@sveltia/ui';

  import { saveAssets } from '$lib/services/assets/data/create';
  import { getAssetBlob } from '$lib/services/assets/info';
  import { editingAsset } from '$lib/services/assets/state';
  import { showAssetOverlay } from '$lib/services/assets/view';
  import { isCommitCancelled } from '$lib/services/backends/commit-prompt';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  const asset = $derived(editingAsset.current);
  let open = $state(false);
  /** @type {Blob | undefined} */
  let blob = $state();
  /** @type {string | undefined} */
  let originalValue = $state();
  /** @type {string | undefined} */
  let currentValue = $state();
  /** @type {boolean | 'mixed'} */
  let wrap = $state(false);
  /** Whether the edited text is being saved, during which the state is kept for a retry. */
  let saving = false;
  let savingFailed = $state(false);

  /**
   * Initialize the state.
   */
  const initState = async () => {
    blob = await getAssetBlob(/** @type {Asset} */ (asset));
    originalValue = await blob.text();
    currentValue = originalValue;
    open = true;
  };

  /**
   * Reset the state.
   */
  const resetState = () => {
    editingAsset.current = undefined;
    blob = undefined;
    originalValue = undefined;
    currentValue = undefined;
  };

  /**
   * Save the edited asset. If saving fails, the dialog is opened again with the edited text, so the
   * user can retry without losing it.
   */
  const saveAsset = async () => {
    /* v8 ignore next 3 -- the dialog is only shown once the asset is loaded */
    if (!asset || !blob || typeof currentValue !== 'string') {
      return;
    }

    saving = true;

    try {
      await saveAssets(
        {
          folder: asset.folder,
          files: [new File([currentValue], asset.name, { type: blob.type })],
          originalAssets: [asset],
        },
        { commitType: 'uploadMedia' },
      );
    } catch (/** @type {any} */ ex) {
      // The user has cancelled the commit at the commit message prompt, which isn’t a failure
      if (!isCommitCancelled(ex)) {
        savingFailed = true;
        // eslint-disable-next-line no-console
        console.error(ex);
      }

      // The asset details overlay may have been closed in the meantime
      if (showAssetOverlay.current) {
        open = true;

        return;
      }
    } finally {
      saving = false;
    }

    resetState();
  };

  /* v8 ignore start -- the title is only read while the dialog is open, for an asset */
  const title = $derived(_('edit_x', { values: { name: asset?.name ?? '' } }));
  /* v8 ignore stop */

  $effect(() => {
    if (asset && blob === undefined) {
      initState();
    }
  });

  $effect(() => {
    if (!showAssetOverlay.current) {
      open = false;
    }
  });
</script>

<Dialog
  size="x-large"
  {title}
  bind:open
  okLabel={_('save')}
  okDisabled={currentValue === originalValue}
  okShortcuts="Accel+S"
  onOk={() => {
    saveAsset();
  }}
  onClose={() => {
    // Keep the state while saving, in case the dialog has to be reopened
    if (!saving) {
      resetState();
    }
  }}
>
  <div role="none" class="wrapper" class:wrap>
    <TextArea dir="auto" bind:value={currentValue} flex />
  </div>
  {#snippet footerExtra()}
    <Switch label={_('wrap_long_lines')} bind:checked={wrap} />
  {/snippet}
</Dialog>

<Toast bind:show={savingFailed}>
  <Alert status="error">{_('saving_asset_failed')}</Alert>
</Toast>

<style>
  .wrapper {
    display: contents;

    :global {
      textarea {
        min-height: 40dvh;
        max-height: 80dvh;
        font-family: var(--sui-font-family-monospace);
        font-size: var(--sui-font-size-monospace);
        text-wrap: nowrap;
        resize: vertical;
      }

      &.wrap textarea {
        text-wrap: wrap;
      }
    }
  }
</style>
