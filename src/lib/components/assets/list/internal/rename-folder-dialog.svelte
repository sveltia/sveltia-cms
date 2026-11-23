<!--
  @component
  Rename Folder dialog of the Asset Library, opened for the subfolder set as `renamingSubfolder`.
  Renaming moves every asset in the folder along, updating the entries using them.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import SubfolderNameDialog from '$lib/components/assets/list/subfolder-name-dialog.svelte';
  import { runAssetCommit } from '$lib/services/assets/data/commit';
  import { getSubfolderAssets, renameSubfolder } from '$lib/services/assets/data/subfolder';
  import {
    browsedDirPath,
    getTakenNames,
    renamingSubfolder,
  } from '$lib/services/assets/subfolders';
  import { listedAssets, listedSubfolders } from '$lib/services/assets/view';
  import { createPath, getDirName } from '$lib/services/utils/file';

  const subfolder = $derived(renamingSubfolder.current);
  // Open while there’s a folder to act on. Closing the dialog writes `open` back, and the folder is
  // let go of once the dialog has closed
  let open = $derived(!!subfolder);
  /* v8 ignore start -- these are only read while the dialog is open, which takes a folder */
  const currentName = $derived(subfolder?.name ?? '');
  /** Number of assets in the folder, at any depth, which will be moved along. */
  const assetCount = $derived(subfolder ? getSubfolderAssets(subfolder.path).length : 0);
  /* v8 ignore stop */
  /**
   * Names taken by the siblings of the folder, which it can’t take over, including the folders
   * leading to another asset folder nested in the directory.
   */
  const takenNames = $derived(
    getTakenNames({
      subfolders: listedSubfolders.current,
      fileNames: listedAssets.current.map(({ name }) => name),
      exclude: currentName,
      dirPath: browsedDirPath.current,
    }),
  );

  /**
   * Rename the folder.
   * @param {string} newName New folder name.
   */
  const rename = (newName) => {
    /* v8 ignore next 3 -- the dialog is only open for a folder */
    if (!subfolder) {
      return;
    }

    const { path } = subfolder;

    runAssetCommit(
      () => renameSubfolder({ dirPath: path, newDirPath: createPath([getDirName(path), newName]) }),
      { progress: 'renaming_folder', failure: 'renaming_folder_failed' },
    );
  };
</script>

<SubfolderNameDialog
  bind:open
  title={_('rename_x', { values: { name: currentName } })}
  okLabel={_('rename')}
  description={_('enter_new_name_for_folder', { values: { count: assetCount } })}
  name={currentName}
  {takenNames}
  onSubmit={(name) => {
    rename(name);
  }}
  onClose={() => {
    // The dialog is closed before the name is submitted, so the folder is let go of here rather
    // than when `open` turns false
    renamingSubfolder.current = undefined;
  }}
/>
