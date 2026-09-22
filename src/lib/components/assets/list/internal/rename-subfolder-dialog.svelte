<!--
  @component
  Rename Folder dialog of the Asset Library, opened for the subfolder set as `renamingSubfolder`.
  Renaming moves every asset in the folder along, updating the entries using them.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';

  import SubfolderNameDialog from '$lib/components/assets/list/subfolder-name-dialog.svelte';
  import { getSubfolderAssets, renameSubfolder } from '$lib/services/assets/data/subfolder';
  import { getDirName, renamingSubfolder } from '$lib/services/assets/subfolders';
  import { listedAssets, listedSubfolders } from '$lib/services/assets/view';
  import { createPath } from '$lib/services/utils/file';

  let open = $state(false);
  // Committing to a remote repository takes a few seconds, and the dialog is gone by then, so the
  // folder would otherwise be renamed with nothing on screen to say it’s under way
  let renaming = $state(false);
  let renamingFailed = $state(false);

  const subfolder = $derived(renamingSubfolder.current);
  /* v8 ignore start -- these are only read while the dialog is open, which takes a folder */
  const currentName = $derived(subfolder?.name ?? '');
  /** Number of assets in the folder, at any depth, which will be moved along. */
  const assetCount = $derived(subfolder ? getSubfolderAssets(subfolder.path).length : 0);
  /* v8 ignore stop */
  /** Names taken by the siblings of the folder, which it can’t take over. */
  const takenNames = $derived([
    ...listedSubfolders.current.map(({ name }) => name).filter((n) => n !== currentName),
    ...listedAssets.current.map(({ name }) => name),
  ]);

  /**
   * Rename the folder.
   * @param {string} newName New folder name.
   */
  const rename = async (newName) => {
    /* v8 ignore next 3 -- the dialog is only open for a folder */
    if (!subfolder) {
      return;
    }

    const { path } = subfolder;

    renaming = true;

    try {
      await renameSubfolder({
        dirPath: path,
        newDirPath: createPath([getDirName(path), newName]),
      });
    } catch (/** @type {any} */ ex) {
      renamingFailed = true;
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      renaming = false;
    }
  };

  $effect(() => {
    if (subfolder) {
      open = true;
    }
  });
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

<!-- `duration={0}` keeps this up until the commit settles, however long it takes -->
<Toast show={renaming} duration={0}>
  <Alert status="info">{_('renaming_folder')}</Alert>
</Toast>

<Toast bind:show={renamingFailed}>
  <Alert status="error">{_('renaming_folder_failed')}</Alert>
</Toast>
