<!--
  @component
  Info panel for a folder in the Asset Library, shown in the sidebar while no asset is focused: the
  folder name, its path and what it holds. The folder is the listed subfolder focused with a click
  or the keyboard, if any, or else the folder being browsed.
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Icon } from '@sveltia/ui';

  import InfoPanelLayout from '$lib/components/assets/list/info-panel-layout.svelte';
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

{#snippet preview()}
  <div role="none" class="folder-preview">
    <Icon name="folder" />
  </div>
{/snippet}

<InfoPanelLayout {preview}>
  <section>
    <h4>{_('folder')}</h4>
    <p><bdi>{info.name}</bdi></p>
  </section>
  {#if info.path !== undefined}
    <section>
      <h4>{_('folder_path')}</h4>
      <p><bdi dir="ltr">{`/${info.path}`}</bdi></p>
    </section>
  {/if}
  <section>
    <h4>{_('folder_contents')}</h4>
    {#if info.folderCount !== undefined}
      <p>{_('x_folders', { values: { count: info.folderCount } })}</p>
    {/if}
    <p>{_('x_assets', { values: { count: info.assetCount } })}</p>
  </section>
</InfoPanelLayout>

<style>
  .folder-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--sui-secondary-foreground-color);

    :global(.sui.icon) {
      font-size: 96px;
    }
  }
</style>
