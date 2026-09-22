<!--
  @component
  Rename Folder dialog for a cloud storage service, opened for the subfolder set as
  `renamingExternalSubfolder`. Renaming moves every file in the folder along, one by one.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import SubfolderNameDialog from '$lib/components/assets/list/subfolder-name-dialog.svelte';
  import { renamingExternalSubfolder } from '$lib/services/assets/external';
  import {
    getExternalSubfolderAssets,
    renameExternalFolder,
  } from '$lib/services/assets/external/data';
  import {
    listedExternalAssets,
    listedExternalSubfolders,
  } from '$lib/services/assets/external/view';

  let open = $state(false);

  const subfolder = $derived(renamingExternalSubfolder.current);
  /* v8 ignore start -- these are only read while the dialog is open, which takes a folder */
  const currentName = $derived(subfolder?.name ?? '');
  /** Number of assets in the folder, at any depth, which will be moved along. */
  const assetCount = $derived(subfolder ? getExternalSubfolderAssets(subfolder.path).length : 0);
  /* v8 ignore stop */
  /** Names taken by the siblings of the folder, which it can’t take over. */
  const takenNames = $derived([
    ...listedExternalSubfolders.current.map(({ name }) => name).filter((n) => n !== currentName),
    ...listedExternalAssets.current.map(({ fileName }) => fileName),
  ]);

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
  description={_('enter_new_name_for_external_folder', { values: { count: assetCount } })}
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
