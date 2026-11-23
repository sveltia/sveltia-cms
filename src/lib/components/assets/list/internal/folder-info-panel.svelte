<!--
  @component
  Info panel for a folder in the Asset Library, shown in the sidebar while no asset is focused: the
  folder name, its path and what it holds. The folder is the listed subfolder focused with a click
  or the keyboard, if any, or else the folder being browsed.
-->
<script>
  import FolderInfoPanel from '$lib/components/assets/list/folder-info-panel.svelte';
  import { folderSummary } from '$lib/services/assets/view';

  /**
   * @import { AssetFolderSummary } from '$lib/types/private';
   */

  /** The panel is only shown with a folder selected. */
  const info = $derived(/** @type {AssetFolderSummary} */ (folderSummary.current));
</script>

<FolderInfoPanel
  name={info.name}
  path={info.path}
  folderCount={info.folderCount}
  assetCount={info.assetCount}
/>
