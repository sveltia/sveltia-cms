<script>
  import { Dialog, Switch, TextArea } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { editingAsset, getAssetBlob, showAssetOverlay } from '$lib/services/assets';
  import { saveAssets } from '$lib/services/assets/data';

  const asset = $derived($editingAsset);
  let open = $state(false);
  /** @type {Blob | undefined} */
  let blob = $state();
  /** @type {string | undefined} */
  let originalValue = $state();
  /** @type {string | undefined} */
  let currentValue = $state();
  /** @type {boolean | 'mixed'} */
  let wrap = $state(false);

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
    $editingAsset = undefined;
    blob = undefined;
    originalValue = undefined;
    currentValue = undefined;
  };

  /**
   * Save the edited asset.
   */
  const saveAsset = async () => {
    if (asset && blob && typeof currentValue === 'string') {
      await saveAssets(
        {
          folder: asset.folder,
          files: [new File([currentValue], asset.name, { type: blob.type })],
          originalAsset: asset,
        },
        { commitType: 'uploadMedia' },
      );
    }
  };

  $effect(() => {
    if (asset && blob === undefined) {
      initState();
    }
  });

  $effect(() => {
    if (!$showAssetOverlay) {
      open = false;
    }
  });
</script>

<Dialog
  size="x-large"
  title={$_('edit_x', { values: { name: asset?.name } })}
  bind:open
  okLabel={$_('save')}
  okDisabled={currentValue === originalValue}
  onOk={() => {
    saveAsset();
  }}
  onClose={() => {
    resetState();
  }}
>
  <div role="none" class="wrapper" class:wrap>
    <TextArea bind:value={currentValue} flex />
  </div>
  {#snippet footerExtra()}
    <Switch label={$_('wrap_long_lines')} bind:checked={wrap} />
  {/snippet}
</Dialog>

<style lang="scss">
  .wrapper {
    display: contents;

    :global(textarea) {
      min-height: 40dvh;
      max-height: 80dvh;
      font-family: var(--sui-font-family-monospace);
      font-size: var(--sui-font-size-monospace);
      text-wrap: nowrap;
      resize: vertical;
    }

    &.wrap :global(textarea) {
      text-wrap: wrap;
    }
  }
</style>
