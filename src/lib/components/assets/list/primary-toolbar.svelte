<script>
  import { Button, Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import DeleteAssetsDialog from '$lib/components/assets/shared/delete-assets-dialog.svelte';
  import FilePicker from '$lib/components/assets/shared/file-picker.svelte';
  import { selectedAssetFolderPath, selectedAssets, uploadingAssets } from '$lib/services/assets';
  import { getFolderLabel } from '$lib/services/assets/view';
  import { siteConfig } from '$lib/services/config';

  const searchTerms = '';
  let filePicker;
  let showDeleteDialog = false;
</script>

<Toolbar class="primary">
  <h2>
    {#if searchTerms}
      {$_('search_results_for_x', { values: { terms: searchTerms } })}
    {:else}
      {getFolderLabel($selectedAssetFolderPath)}
      {#if $selectedAssetFolderPath}
        <span>/{$selectedAssetFolderPath}</span>
      {/if}
    {/if}
  </h2>
  <Spacer flex={true} />
  <Button
    class="secondary"
    disabled={!$selectedAssets.length}
    iconName="delete"
    label={$_('delete')}
    on:click={() => {
      showDeleteDialog = true;
    }}
  />
  <!-- @todo Implement these actions. -->
  <!--
  <Button
    class="secondary"
    disabled={$selectedAssets.length !== 1}
    iconName="file_copy"
    label={$_('copy')}
    on:click={() => {
      //
    }}
  />
  <Button
    class="secondary"
    disabled={!$selectedAssets.length}
    iconName="download"
    label={$_('download')}
    on:click={() => {
      //
    }}
  />
  -->
  <Button
    class="primary"
    iconName="cloud_upload"
    label={$_('upload')}
    on:click={() => {
      filePicker.open();
    }}
  />
</Toolbar>

<FilePicker
  bind:this={filePicker}
  multiple={true}
  on:change={({ target }) => {
    $uploadingAssets = {
      folder: $selectedAssetFolderPath || $siteConfig.media_folder,
      files: [...target.files],
    };
  }}
/>

<DeleteAssetsDialog bind:open={showDeleteDialog} assets={$selectedAssets} />
