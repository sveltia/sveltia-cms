<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import FilePicker from '$lib/components/assets/shared/file-picker.svelte';
  import { globalAssetFolder, selectedAssetFolder, uploadingAssets } from '$lib/services/assets';

  /**
   * @type {FilePicker}
   */
  let filePicker;

  // Can’t upload assets if collection assets are saved at entry-relative paths
  $: uploadDisabled = !!$selectedAssetFolder?.entryRelative;
</script>

<Button
  variant="primary"
  label={$_('upload')}
  disabled={uploadDisabled}
  aria-label={$_('upload_files')}
  on:click={() => {
    filePicker.open();
  }}
>
  <Icon slot="start-icon" name="cloud_upload" />
</Button>

<FilePicker
  bind:this={filePicker}
  multiple={true}
  on:change={({ target }) => {
    $uploadingAssets = {
      folder: $selectedAssetFolder?.internalPath || $globalAssetFolder?.internalPath,
      files: [.../** @type {FileList} */ (/** @type {HTMLInputElement} */ (target).files)],
    };
  }}
/>
