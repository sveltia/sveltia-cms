<!--
  @component
  Rename Asset dialog for an asset on a cloud storage service. As with repository assets, the
  entries linking to the asset are pointed at its new URL, and the dialog opens once they have been
  found, so it can tell how many will be updated, or refuse the rename if they can’t be. The new
  name is checked against the other assets in the same virtual folder on the service.
-->
<script>
  import { getPathInfo } from '@sveltia/utils/file';

  import RenameDialog from '$lib/components/assets/list/rename-dialog.svelte';
  import { goto } from '$lib/services/app/navigation';
  import {
    externalAssets,
    getExternalAssetPath,
    overlaidExternalAssetId,
    renamingExternalAsset,
    selectedCloudService,
  } from '$lib/services/assets/external';
  import { renameExternalAsset } from '$lib/services/assets/external/data';
  import { getExternalAssetUsedEntries } from '$lib/services/assets/external/details';
  import { getExternalChangeBlockedMessage } from '$lib/services/assets/external/move';
  import { createUsedEntriesState } from '$lib/services/assets/used-entries.svelte';

  const asset = $derived(renamingExternalAsset.current);
  /** Entries linking to the asset, which are updated along with the rename. */
  const usedEntries = createUsedEntriesState(() =>
    asset ? getExternalAssetUsedEntries(asset) : undefined,
  );
  // Open while there’s an asset to act on, once the entries using it have been found, so the rename
  // can be refused up front. Closing the dialog writes `open` back, and the asset is let go of once
  // the dialog has closed
  let open = $derived(!!asset && !!usedEntries.entries);
  /* v8 ignore start -- the dialog is only shown for a listed asset */
  const { dirname } = $derived(getPathInfo(asset?.id ?? ''));
  const listedAssets = $derived(externalAssets.current ?? []);
  /* v8 ignore stop */
  /** Names of the other assets in the same folder on the service. */
  const otherNames = $derived(
    listedAssets
      .filter((a) => a.id !== asset?.id && getPathInfo(a.id).dirname === dirname)
      .map((a) => a.fileName),
  );

  // The rename is refused up front if the entries can’t be updated
  const blockedMessage = $derived(getExternalChangeBlockedMessage(usedEntries.entries ?? [], 1));

  /**
   * Rename the asset. Also, update the URL hash silently to reflect the new asset ID if the rename
   * dialog was opened in the asset details view.
   * @param {string} newName New file name.
   */
  const renameAsset = async (newName) => {
    const service = selectedCloudService.current;

    /* v8 ignore next 3 -- the dialog is only shown for an asset on the selected service */
    if (!asset || !service) {
      return;
    }

    const oldId = asset.id;
    const renamedAsset = await renameExternalAsset(asset, newName);

    if (renamedAsset && overlaidExternalAssetId.current === oldId) {
      overlaidExternalAssetId.current = renamedAsset.id;
      await goto(getExternalAssetPath(service, renamedAsset), {
        replaceState: true,
        notifyChange: false,
      });
    }
  };
</script>

<RenameDialog
  bind:open
  name={asset?.fileName ?? ''}
  {otherNames}
  usedEntryCount={usedEntries.entries?.length}
  {blockedMessage}
  onRename={renameAsset}
  onClose={() => {
    renamingExternalAsset.current = undefined;
  }}
/>
