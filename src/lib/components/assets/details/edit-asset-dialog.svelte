<script>
  import { Dialog, Switch, TextArea } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { editingAsset, getAssetBlob } from '$lib/services/assets';
  import { saveAssets } from '$lib/services/assets/data';

  /** @type {Asset | undefined} */
  $: asset = $editingAsset;

  /** @type {boolean} */
  let open = false;
  /** @type {Blob | undefined} */
  let blob = undefined;
  /** @type {string | undefined} */
  let originalValue = undefined;
  /** @type {string | undefined} */
  let currentValue = undefined;
  /** @type {boolean} */
  let wrap = false;

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

  $: {
    if (asset && blob === undefined) {
      initState();
    }
  }
</script>

<Dialog
  size="x-large"
  title={$_('edit_x', { values: { name: asset?.name } })}
  bind:open
  okLabel={$_('save')}
  okDisabled={currentValue === originalValue}
  on:ok={() => {
    saveAsset();
  }}
  on:close={() => {
    resetState();
  }}
>
  <div role="none" class="wrapper" class:wrap>
    <TextArea bind:value={currentValue} flex />
  </div>
  <svelte:fragment slot="footer-extra">
    <Switch label={$_('wrap_long_lines')} bind:checked={wrap} />
  </svelte:fragment>
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
