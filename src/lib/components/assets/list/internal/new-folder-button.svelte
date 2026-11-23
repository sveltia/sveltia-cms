<!--
  @component
  New Folder button for a repository folder, which opens the New Folder dialog. Only rendered when
  the folder can be browsed by subfolder.
-->
<script>
  import NewFolderButton from '$lib/components/assets/list/new-folder-button.svelte';
  import { assetsLocked, canCreateAsset, selectedAssetFolder } from '$lib/services/assets/folders';
  import { browsingCmsFolder, canBrowseSubfolders } from '$lib/services/assets/subfolders';
  import { showNewSubfolderDialog } from '$lib/services/assets/view';

  const folder = $derived(selectedAssetFolder.current);
  // Creating a folder commits straight to the configured branch rather than going through review,
  // so it’s not something an Open Authoring contributor or a user who can’t push to the branch can
  // do, just like uploading. Nor can anything be added to a folder the CMS itself is served from
  const disabled = $derived(
    assetsLocked.current || !canCreateAsset(folder) || browsingCmsFolder.current,
  );
</script>

{#if canBrowseSubfolders(folder)}
  <NewFolderButton
    {disabled}
    onclick={() => {
      showNewSubfolderDialog.current = true;
    }}
  />
{/if}
