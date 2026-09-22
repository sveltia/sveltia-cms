<!--
  @component
  Info panel for a folder in the Asset Library, shown in the sidebar while no asset is focused: the
  folder name, its path and what it holds. The folder is the listed subfolder focused with a click
  or the keyboard, if any, or else the folder being browsed.
-->
<script>
  import { locale as appLocale } from '@sveltia/i18n';

  import FolderInfoPanel from '$lib/components/assets/list/folder-info-panel.svelte';
  import { selectedAssetFolder } from '$lib/services/assets/folders';
  import {
    browsedDirPath,
    focusedSubfolder,
    getDirName,
    getSubfolders,
    selectedSubfolderPath,
  } from '$lib/services/assets/subfolders';
  import {
    getFolderLabelByCollection,
    listedAssets,
    listedSubfolders,
    selectedFolderAssets,
  } from '$lib/services/assets/view';

  /**
   * @import { AssetFolderInfo } from '$lib/types/private';
   */

  /* v8 ignore start -- the panel is only shown with a folder selected */
  const folder = $derived(/** @type {AssetFolderInfo} */ (selectedAssetFolder.current));
  /* v8 ignore stop */
  const subfolder = $derived(focusedSubfolder.current);

  /**
   * What the panel describes: the focused subfolder, or the folder being browsed — the subfolder
   * being browsed if any, otherwise the selected folder itself.
   */
  const info = $derived.by(() => {
    if (subfolder) {
      const { name, path } = subfolder;
      const assets = selectedFolderAssets.current;

      return {
        name,
        path,
        folderCount: getSubfolders({ dirPath: path, assets }).length,
        assetCount: assets.filter((asset) => getDirName(asset.path) === path).length,
      };
    }

    const dirPath = browsedDirPath.current;

    return {
      name:
        selectedSubfolderPath.current.split('/').at(-1) ||
        // `appLocale.current` is a key, because the label can be localized
        (appLocale.current && getFolderLabelByCollection(folder)),
      // The All Assets folder has no path
      path: dirPath ?? folder.internalPath,
      // A folder that isn’t browsed by subfolder lists every asset below it at once
      folderCount: dirPath === undefined ? undefined : listedSubfolders.current.length,
      assetCount: listedAssets.current.length,
    };
  });
</script>

<FolderInfoPanel
  name={info.name}
  path={info.path}
  folderCount={info.folderCount}
  assetCount={info.assetCount}
/>
