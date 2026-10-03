<!--
  @component
  Info panel for a folder on a cloud storage service, shown in the sidebar while no asset is
  focused. The folder is the listed subfolder focused with a click or the keyboard, if any, or else
  the folder being browsed.
-->
<script>
  import FolderInfoPanel from '$lib/components/assets/list/folder-info-panel.svelte';
  import { externalFolderSummary } from '$lib/services/assets/external/view';

  /**
   * @import { AssetFolderSummary } from '$lib/types/private';
   */

  /** The component is only rendered while a service is selected. */
  const info = $derived(/** @type {AssetFolderSummary} */ (externalFolderSummary.current));
</script>

<FolderInfoPanel
  name={info.name}
  path={info.path}
  folderCount={info.folderCount}
  assetCount={info.assetCount}
/>
