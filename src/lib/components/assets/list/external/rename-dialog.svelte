<!--
  @component
  Rename Asset dialog for an asset on a cloud storage service. Unlike the dialog for repository
  assets, the entries using the asset aren’t updated, as they hotlink its URL, so the dialog warns
  that their links will break instead. The new name is checked against the other assets in the
  same virtual folder on the service.
-->
<script>
  import { _ } from '@sveltia/i18n';
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

  /**
   * @import { ExternalAsset } from '$lib/types/private';
   */

  const asset = $derived(renamingExternalAsset.current);
  // Open while there’s an asset to act on. Closing the dialog writes `open` back, and the asset is
  // let go of once the dialog has closed
  let open = $derived(!!asset);
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

  /** Number of entries linking to the asset, whose links the rename will break. */
  let usedEntryCount = $state(0);

  /**
   * Count the entries linking to the given asset.
   * @param {ExternalAsset | undefined} _asset Asset being renamed, if any.
   */
  const countUsedEntries = async (_asset) => {
    usedEntryCount = 0;

    if (!_asset) {
      return;
    }

    const entries = await getExternalAssetUsedEntries(_asset);

    // Another asset may have been picked in the meantime
    if (asset === _asset) {
      usedEntryCount = entries.length;
    }
  };

  $effect(() => {
    countUsedEntries(asset);
  });

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
  warning={usedEntryCount
    ? _('renaming_external_asset_breaks_links', { values: { count: usedEntryCount } })
    : undefined}
  onRename={renameAsset}
  onClose={() => {
    renamingExternalAsset.current = undefined;
  }}
/>
