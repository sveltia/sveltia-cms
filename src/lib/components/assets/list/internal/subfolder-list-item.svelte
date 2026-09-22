<!--
  @component
  A row or tile for a subfolder of a repository folder in the Asset Library. Opening it browses the
  folder, and the menu offers to rename or delete the folder.
-->
<script>
  import SubfolderListItem from '$lib/components/assets/list/subfolder-list-item.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { focusedAsset } from '$lib/services/assets';
  import { selectedAssetFolder } from '$lib/services/assets/folders';
  import {
    deletingSubfolder,
    focusedSubfolder,
    renamingSubfolder,
  } from '$lib/services/assets/subfolders';
  import { env } from '$lib/services/user/env.svelte';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  /**
   * @import { AssetSubfolder, ViewType } from '$lib/types/private';
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

  /**
   * Browse the subfolder. The selected asset folder travels as history state, the same way it does
   * from the sidebar, so the page can tell it from another folder sharing its path.
   */
  const open = () => {
    goto(`/assets/${subfolder.path}`, {
      transitionType: 'forwards',
      state: { folder: selectedAssetFolder.current },
    });
  };
</script>

<!--
  Renaming or deleting a folder commits straight to the configured branch rather than going through
  review, so neither is available to an Open Authoring contributor
-->
<SubfolderListItem
  {subfolder}
  {rowIndex}
  {viewType}
  hasCheckboxColumn={!(env.isSmallScreen || env.isMediumScreen)}
  onOpen={open}
  onFocus={() => {
    // Show the folder’s info in the sidebar in place of an asset’s
    focusedSubfolder.current = subfolder;
    focusedAsset.current = undefined;
  }}
  onRename={() => {
    renamingSubfolder.current = subfolder;
  }}
  onDelete={() => {
    deletingSubfolder.current = subfolder;
  }}
  actionsDisabled={openAuthoring.current}
/>
