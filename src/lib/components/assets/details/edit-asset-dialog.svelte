<script>
  import { Dialog, TextArea } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import {
    allAssets,
    editingAsset,
    focusedAsset,
    getBlob,
    overlaidAsset,
  } from '$lib/services/assets';
  import { saveAssets } from '$lib/services/assets/data';

  /** @type {Asset | undefined} */
  $: asset = $editingAsset;

  /** @type {Blob | undefined} */
  let blob = undefined;
  /** @type {string | undefined} */
  let originalValue = undefined;
  /** @type {string | undefined} */
  let currentValue = undefined;

  /**
   * Initialize the state.
   */
  const initState = async () => {
    blob = await getBlob(/** @type {Asset} */ (asset));
    originalValue = await blob.text();
    currentValue = originalValue;
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
          override: true,
        },
        { commitType: 'uploadMedia' },
      );

      if ($focusedAsset) {
        $focusedAsset = $allAssets.find((a) => a.path === $focusedAsset?.path);
      }

      if ($overlaidAsset) {
        $overlaidAsset = $allAssets.find((a) => a.path === $overlaidAsset?.path);
      }
    }
  };

  $: {
    if (asset && blob === undefined) {
      initState();
    }
  }
</script>

{#if asset}
  <Dialog
    size="x-large"
    title={$_('editing_x', { values: { name: asset.name } })}
    open={true}
    okLabel={$_('save')}
    okDisabled={currentValue === originalValue}
    on:ok={() => {
      saveAsset();
    }}
    on:close={() => {
      resetState();
    }}
  >
    <div class="wrapper">
      <TextArea bind:value={currentValue} flex />
    </div>
  </Dialog>
{/if}

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
  }
</style>
