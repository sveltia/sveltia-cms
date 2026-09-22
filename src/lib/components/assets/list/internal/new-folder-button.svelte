<!--
  @component
  New Folder button for a repository folder, which opens the New Folder dialog. Only rendered when
  the folder can be browsed by subfolder.
-->
<script>
  import NewFolderButton from '$lib/components/assets/list/new-folder-button.svelte';
  import { canCreateAsset, selectedAssetFolder } from '$lib/services/assets/folders';
  import { canBrowseSubfolders } from '$lib/services/assets/subfolders';
  import { showNewSubfolderDialog } from '$lib/services/assets/view';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  const folder = $derived(selectedAssetFolder.current);
  // Creating a folder commits straight to the configured branch rather than going through review,
  // so it’s not something an Open Authoring contributor can do, just like uploading
  const disabled = $derived(openAuthoring.current || !canCreateAsset(folder));
</script>

{#if canBrowseSubfolders(folder)}
  <NewFolderButton
    {disabled}
    onclick={() => {
      showNewSubfolderDialog.current = true;
    }}
  />
{/if}
