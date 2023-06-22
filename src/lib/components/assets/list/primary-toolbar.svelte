<script>
  import { Button, Icon, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import DeleteAssetsDialog from '$lib/components/assets/shared/delete-assets-dialog.svelte';
  import FilePicker from '$lib/components/assets/shared/file-picker.svelte';
  import { selectedAssetFolderPath, selectedAssets, uploadingAssets } from '$lib/services/assets';
  import { getFolderLabelByPath } from '$lib/services/assets/view';
  import { siteConfig } from '$lib/services/config';

  /**
   * @type {import('svelte').SvelteComponentTyped}
   */
  let filePicker = undefined;
  let showDeleteDialog = false;
</script>

<Toolbar class="primary">
  <h2>
    {getFolderLabelByPath($selectedAssetFolderPath)}
    {#if $selectedAssetFolderPath}
      <span>/{$selectedAssetFolderPath}</span>
    {/if}
  </h2>
  <Spacer flex={true} />
  <Button
    class="secondary"
    disabled={!$selectedAssets.length}
    label={$_('delete')}
    on:click={() => {
      showDeleteDialog = true;
    }}
  >
    <Icon slot="start-icon" name="delete" />
  </Button>
  <!-- @todo Implement these actions. -->
  <!--
  <Button
    class="secondary"
    disabled={$selectedAssets.length !== 1}
    label={$_('copy')}
    on:click={() => {
      //
    }}
  >
    <Icon slot="start-icon" name="file_copy" />
  </Button>
  <Button
    class="secondary"
    disabled={!$selectedAssets.length}
    label={$_('download')}
    on:click={() => {
      //
    }}
  >
    <Icon slot="start-icon" name="download" />
  </Button>
  -->
  <Button
    class="primary"
    label={$_('upload')}
    on:click={() => {
      filePicker.open();
    }}
  >
    <Icon slot="start-icon" name="cloud_upload" />
  </Button>
</Toolbar>

<FilePicker
  bind:this={filePicker}
  multiple={true}
  on:change={({ target }) => {
    $uploadingAssets = {
      folder: $selectedAssetFolderPath || $siteConfig.media_folder,
      files: [.../** @type {HTMLInputElement} */ (target).files],
    };
  }}
/>

<DeleteAssetsDialog bind:open={showDeleteDialog} assets={$selectedAssets} />
