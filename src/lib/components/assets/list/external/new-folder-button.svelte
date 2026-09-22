<!--
  @component
  New Folder button for a cloud storage service, which opens the New Folder dialog. Only rendered
  when the service can create a folder.
-->
<script>
  import NewFolderButton from '$lib/components/assets/list/new-folder-button.svelte';
  import { selectedCloudService, showNewExternalFolderDialog } from '$lib/services/assets/external';
  import { browsingExternalFolders } from '$lib/services/assets/external/view';
</script>

{#if browsingExternalFolders.current && selectedCloudService.current?.createFolder}
  <NewFolderButton
    onclick={() => {
      showNewExternalFolderDialog.current = true;
    }}
  />
{/if}
