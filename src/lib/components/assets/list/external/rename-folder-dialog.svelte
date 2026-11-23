<!--
  @component
  Rename Folder dialog for a cloud storage service, opened for the subfolder set as
  `renamingExternalSubfolder`. Renaming moves every file in the folder along, one by one, and
  points the entries linking to them at their new URLs. The dialog opens once those entries have
  been found, so it can refuse the rename if they can’t be updated.
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
  import { getExternalChangeBlockedMessage } from '$lib/services/assets/external/move';
  import {
    listedExternalAssets,
    listedExternalSubfolders,
  } from '$lib/services/assets/external/view';
  import { getTakenNames } from '$lib/services/assets/subfolders';
  import { createUsedEntriesState } from '$lib/services/assets/used-entries.svelte';

  const subfolder = $derived(renamingExternalSubfolder.current);
  /* v8 ignore start -- these are only read while the dialog is open, which takes a folder */
  const currentName = $derived(subfolder?.name ?? '');
  /** Assets in the folder, at any depth, which will be moved along. */
  const assets = $derived(subfolder ? getExternalSubfolderAssets(subfolder.path) : []);
  /* v8 ignore stop */
  /** Entries linking to the assets, which are updated along with the rename. */
  const usedEntries = createUsedEntriesState(() =>
    subfolder ? getExternalAssetsUsedEntries(assets) : undefined,
  );
  // The rename is refused up front if the entries can’t be updated
  const blockedMessage = $derived(
    getExternalChangeBlockedMessage(usedEntries.entries ?? [], assets.length),
  );
  // Open while there’s a folder to act on, once the entries using its files have been found, so the
  // rename can be refused up front. Closing the dialog writes `open` back, and the folder is let go
  // of once the dialog has closed
  let open = $derived(!!subfolder && !!usedEntries.entries);

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
  description={_('enter_new_name_for_folder', { values: { count: assets.length } })}
  {blockedMessage}
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
