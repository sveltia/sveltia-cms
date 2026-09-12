<!--
  @component
  Rename Asset dialog for an asset on a cloud storage service. Unlike the dialog for repository
  assets, there are no entries to update, and the new name is checked against the other assets in
  the same virtual folder on the service.
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

  let open = $state(false);

  const asset = $derived(renamingExternalAsset.current);
  const { dirname } = $derived(getPathInfo(asset?.id ?? ''));
  /** Names of the other assets in the same folder on the service. */
  const otherNames = $derived(
    (externalAssets.current ?? [])
      .filter((a) => a.id !== asset?.id && getPathInfo(a.id).dirname === dirname)
      .map((a) => a.fileName),
  );

  /**
   * Rename the asset. Also, update the URL hash silently to reflect the new asset ID if the rename
   * dialog was opened in the asset details view.
   * @param {string} newName New file name.
   */
  const renameAsset = async (newName) => {
    const service = selectedCloudService.current;

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

  $effect(() => {
    if (asset) {
      open = true;
    }
  });
</script>

<RenameDialog
  bind:open
  name={asset?.fileName ?? ''}
  {otherNames}
  onRename={renameAsset}
  onClose={() => {
    renamingExternalAsset.current = undefined;
  }}
/>
