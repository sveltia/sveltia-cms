<!--
  @component
  Info panel for a folder on a cloud storage service, shown in the sidebar while no asset is
  focused. The folder is the listed subfolder focused with a click or the keyboard, if any, or else
  the folder being browsed.
-->
<script>
  import FolderInfoPanel from '$lib/components/assets/list/folder-info-panel.svelte';
  import {
    externalAssets,
    externalFolders,
    focusedExternalSubfolder,
    selectedCloudService,
    selectedExternalDirPath,
  } from '$lib/services/assets/external';
  import {
    browsingExternalFolders,
    listedExternalAssets,
    listedExternalSubfolders,
  } from '$lib/services/assets/external/view';
  import { getDirName, listSubfolders } from '$lib/services/assets/subfolders';

  /**
   * @import { MediaLibraryService } from '$lib/types/private';
   */

  /** The component is only rendered while a service is selected. */
  const service = $derived(/** @type {MediaLibraryService} */ (selectedCloudService.current));
  const subfolder = $derived(focusedExternalSubfolder.current);

  /**
   * What the panel describes: the focused subfolder, or the folder being browsed — the service
   * itself at the root.
   */
  const info = $derived.by(() => {
    if (subfolder) {
      const { name, path } = subfolder;
      const assets = externalAssets.current ?? [];

      return {
        name,
        path,
        folderCount: listSubfolders({
          dirPath: path,
          paths: [
            ...assets.map(({ description }) => description),
            ...externalFolders.current.map((dirPath) => `${dirPath}/`),
          ],
        }).length,
        assetCount: assets.filter(({ description }) => getDirName(description) === path).length,
      };
    }

    // A search looks through the whole service rather than the folder being browsed
    const browsing = browsingExternalFolders.current;
    const dirPath = browsing ? selectedExternalDirPath.current : '';

    return {
      name: dirPath.split('/').at(-1) || service.serviceLabel,
      // The service root has no path of its own
      path: dirPath || undefined,
      folderCount: browsing ? listedExternalSubfolders.current.length : undefined,
      assetCount: listedExternalAssets.current.length,
    };
  });
</script>

<FolderInfoPanel
  name={info.name}
  path={info.path}
  folderCount={info.folderCount}
  assetCount={info.assetCount}
/>
