<!--
  @component
  New Folder dialog for a cloud storage service, opened with the New Folder button. It creates a
  folder in the folder being browsed and reports the result, but leaves the user where they are:
  the new folder is listed along with the others, ready to be opened.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import SubfolderNameDialog from '$lib/components/assets/list/subfolder-name-dialog.svelte';
  import {
    selectedCloudService,
    selectedExternalDirPath,
    showNewExternalFolderDialog,
  } from '$lib/services/assets/external';
  import { createExternalFolder } from '$lib/services/assets/external/data';
  import {
    listedExternalAssets,
    listedExternalSubfolders,
  } from '$lib/services/assets/external/view';

  /**
   * @import { MediaLibraryService } from '$lib/types/private';
   */

  /** The component is only rendered while a service is selected. */
  const service = $derived(/** @type {MediaLibraryService} */ (selectedCloudService.current));
  /** Names already taken in the folder being browsed, which a new folder can’t be given. */
  const takenNames = $derived([
    ...listedExternalSubfolders.current.map(({ name }) => name),
    ...listedExternalAssets.current.map(({ fileName }) => fileName),
  ]);
  /** The folder being browsed, named after the service at the root. */
  const folderLabel = $derived(
    selectedExternalDirPath.current ? `/${selectedExternalDirPath.current}` : service.serviceLabel,
  );
</script>

<SubfolderNameDialog
  bind:open={showNewExternalFolderDialog.current}
  title={_('new_folder')}
  okLabel={_('new_folder_create')}
  description={_('new_folder_description', { values: { folder: folderLabel } })}
  {takenNames}
  onSubmit={(name) => {
    createExternalFolder(name);
  }}
/>
