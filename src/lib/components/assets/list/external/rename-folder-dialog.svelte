<!--
  @component
  Rename Folder dialog for a cloud storage service, opened for the subfolder set as
  `renamingExternalSubfolder`. Renaming moves every file in the folder along, one by one. The
  entries linking to those files aren’t updated, so the dialog warns that their links will break.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import SubfolderNameDialog from '$lib/components/assets/list/subfolder-name-dialog.svelte';
  import { renamingExternalSubfolder } from '$lib/services/assets/external';
  import {
    getExternalSubfolderAssets,
    renameExternalFolder,
  } from '$lib/services/assets/external/data';
  import { getExternalAssetsUsedEntries } from '$lib/services/assets/external/details';
  import {
    listedExternalAssets,
    listedExternalSubfolders,
  } from '$lib/services/assets/external/view';
  import { getTakenNames } from '$lib/services/assets/subfolders';

  /**
   * @import { ExternalAsset } from '$lib/types/private';
   */

  const subfolder = $derived(renamingExternalSubfolder.current);
  // Open while there’s a folder to act on. Closing the dialog writes `open` back, and the folder is
  // let go of once the dialog has closed
  let open = $derived(!!subfolder);
  /* v8 ignore start -- these are only read while the dialog is open, which takes a folder */
  const currentName = $derived(subfolder?.name ?? '');
  /** Assets in the folder, at any depth, which will be moved along. */
  const assets = $derived(subfolder ? getExternalSubfolderAssets(subfolder.path) : []);
  /* v8 ignore stop */
  /** Number of entries linking to the assets, whose links the rename will break. */
  let usedEntryCount = $state(0);

  /**
   * Count the entries linking to any of the given assets.
   * @param {ExternalAsset[]} _assets Assets in the folder being renamed.
   */
  const countUsedEntries = async (_assets) => {
    usedEntryCount = 0;

    const entries = await getExternalAssetsUsedEntries(_assets);

    // Another folder may have been picked in the meantime
    if (assets === _assets) {
      usedEntryCount = entries.length;
    }
  };

  $effect(() => {
    countUsedEntries(assets);
  });
  /** Names taken by the siblings of the folder, which it can’t take over. */
  const takenNames = $derived(
    getTakenNames({
      subfolders: listedExternalSubfolders.current,
      fileNames: listedExternalAssets.current.map(({ fileName }) => fileName),
      exclude: currentName,
    }),
  );
</script>

<SubfolderNameDialog
  bind:open
  title={_('rename_x', { values: { name: currentName } })}
  okLabel={_('rename')}
  description={_('enter_new_name_for_external_folder', { values: { count: assets.length } })}
  warning={usedEntryCount
    ? _('renaming_external_folder_breaks_links', { values: { count: usedEntryCount } })
    : undefined}
  name={currentName}
  {takenNames}
  onSubmit={(name) => {
    /* v8 ignore next 3 -- the dialog is only open for a folder */
    if (subfolder) {
      renameExternalFolder(subfolder, name);
    }
  }}
  onClose={() => {
    // The dialog is closed before the name is submitted, so the folder is let go of here rather
    // than when `open` turns false
    renamingExternalSubfolder.current = undefined;
  }}
/>
