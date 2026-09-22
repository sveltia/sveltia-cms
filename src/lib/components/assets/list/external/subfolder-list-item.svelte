<!--
  @component
  A row or tile for a subfolder on a cloud storage service in the Asset Library. Opening it browses
  the folder, and the menu offers to rename or delete the folder where the service’s API allows.
-->
<script>
  import SubfolderListItem from '$lib/components/assets/list/subfolder-list-item.svelte';
  import {
    browseExternalFolder,
    deletingExternalSubfolder,
    focusedExternalAsset,
    focusedExternalSubfolder,
    renamingExternalSubfolder,
    selectedCloudService,
  } from '$lib/services/assets/external';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { AssetSubfolder, MediaLibraryService, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {AssetSubfolder} subfolder Subfolder.
   * @property {number} rowIndex 0-based index of the subfolder in the list, for `aria-rowindex`.
   * @property {ViewType} viewType View type.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    subfolder,
    rowIndex,
    viewType,
    /* eslint-enable prefer-const */
  } = $props();

  /** The component is only rendered while a service is selected. */
  const service = $derived(/** @type {MediaLibraryService} */ (selectedCloudService.current));
  // Renaming a folder moves its files one by one, so it takes a service that can move a file
  const canRename = $derived(!!service.move && !!service.createFolder && !!service.deleteFolder);
  const canDelete = $derived(!!service.delete && !!service.deleteFolder);
</script>

<SubfolderListItem
  {subfolder}
  {rowIndex}
  {viewType}
  hasCheckboxColumn={!(env.isSmallScreen || env.isMediumScreen)}
  onOpen={() => {
    browseExternalFolder(subfolder.path);
  }}
  onFocus={() => {
    // Show the folder’s info in the sidebar in place of an asset’s
    focusedExternalSubfolder.current = subfolder;
    focusedExternalAsset.current = undefined;
  }}
  onRename={canRename
    ? () => {
        renamingExternalSubfolder.current = subfolder;
      }
    : undefined}
  onDelete={canDelete
    ? () => {
        deletingExternalSubfolder.current = subfolder;
      }
    : undefined}
/>
