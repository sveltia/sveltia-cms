<script>
  import { getPathInfo } from '@sveltia/utils/file';

  import RenameDialog from '$lib/components/assets/list/rename-dialog.svelte';
  import { goto, parseLocation } from '$lib/services/app/navigation';
  import { getAssetsByDirName, renamingAsset } from '$lib/services/assets';
  import { moveAssets } from '$lib/services/assets/data/move';
  import { getAssetUsedEntries } from '$lib/services/assets/details';

  /**
   * @import { Entry } from '$lib/types/private';
   */

  let open = $state(false);
  /** @type {Entry[]} */
  let usedEntries = $state([]);

  const asset = $derived(renamingAsset.current);
  const { dirname = '', basename = '' } = $derived(getPathInfo(asset?.path ?? ''));
  const otherNames = $derived(
    asset
      ? getAssetsByDirName(dirname)
          .map((a) => a.name)
          .filter((n) => n !== asset.name)
      : [],
  );

  /**
   * Rename the asset by moving it to a new path. Also, update the URL hash silently to reflect the
   * new asset name if the rename dialog was opened in the asset details view.
   * @param {string} newName New file name.
   */
  const renameAsset = async (newName) => {
    if (!asset) {
      return;
    }

    const oldPath = asset.path;
    const newPath = `${dirname}/${newName}`;

    await moveAssets('rename', [{ asset, path: newPath }]);

    if (parseLocation().path === `/assets/${oldPath}`) {
      await goto(`/assets/${newPath}`, { replaceState: true, notifyChange: false });
    }
  };

  $effect(() => {
    if (asset) {
      (async () => {
        usedEntries = await getAssetUsedEntries(asset);
        open = true;
      })();
    }
  });
</script>

<RenameDialog
  bind:open
  name={basename}
  {otherNames}
  usedEntryCount={usedEntries.length}
  onRename={renameAsset}
  onClose={() => {
    renamingAsset.current = undefined;
  }}
/>
