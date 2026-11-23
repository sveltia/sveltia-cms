<script>
  import { getPathInfo } from '@sveltia/utils/file';

  import RenameDialog from '$lib/components/assets/list/rename-dialog.svelte';
  import { getAssetsByDirName } from '$lib/services/assets';
  import { runAssetCommit } from '$lib/services/assets/data/commit';
  import { getMoveBlockedMessage, moveAssets } from '$lib/services/assets/data/move';
  import { getAssetUsedEntries } from '$lib/services/assets/details';
  import { replaceShownAssetPath } from '$lib/services/assets/navigation';
  import { renamingAsset } from '$lib/services/assets/state';
  import { getFolderNamesInDir, getNonAssetFileNamesInDir } from '$lib/services/assets/subfolders';
  import { createUsedEntriesState } from '$lib/services/assets/used-entries.svelte';
  import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
  import { createPath } from '$lib/services/utils/file';

  let open = $state(false);

  const asset = $derived(renamingAsset.current);
  /**
   * Entries using the asset, which are updated along with the rename. The dialog opens once they
   * have been found. Another asset can be renamed before then, which the state takes care of.
   */
  const usedEntries = createUsedEntriesState(
    () => (asset ? getAssetUsedEntries(asset) : undefined),
    () => {
      open = true;
    },
  );
  // A read-only entry using the asset can’t be updated along with the rename, so the rename is
  // refused up front rather than when it’s about to be committed
  const blockedMessage = $derived(getMoveBlockedMessage(usedEntries.entries ?? []));
  const { dirname = '', basename = '' } = $derived(getPathInfo(asset?.path ?? ''));
  /**
   * Names of the other files next to the asset, and those of the subfolders there, which a file
   * can’t take either.
   */
  const { otherNames, fileNames, folderNames } = $derived(
    asset
      ? {
          otherNames: getAssetsByDirName(dirname)
            .map((a) => a.name)
            .filter((n) => n !== asset.name),
          // An entry file next to the asset would be overwritten
          fileNames: getNonAssetFileNamesInDir(dirname),
          folderNames: getFolderNamesInDir(dirname),
        }
      : { otherNames: [], fileNames: [], folderNames: [] },
  );

  /**
   * Rename the asset by moving it to a new path. Also, update the URL hash silently to reflect the
   * new asset name if the rename dialog was opened in the asset details view.
   * @param {string} newName New file name.
   */
  const renameAsset = async (newName) => {
    /* v8 ignore next 3 -- the dialog is only shown for an asset */
    if (!asset) {
      return;
    }

    const oldPath = asset.path;
    // An asset in a root media folder has no directory
    const newPath = createPath([dirname, newName]);

    const { ok } = await runAssetCommit(() => moveAssets('rename', [{ asset, path: newPath }]), {
      failure: 'renaming_asset_failed',
    });

    if (ok) {
      await replaceShownAssetPath(oldPath, newPath);
    }
  };
</script>

<RenameDialog
  bind:open
  name={basename}
  {otherNames}
  {fileNames}
  {folderNames}
  usedEntryCount={usedEntries.entries?.length}
  {blockedMessage}
  slugificationEnabled={getDefaultMediaLibraryOptions().config.slugify_filename}
  onRename={renameAsset}
  onClose={() => {
    renamingAsset.current = undefined;
  }}
/>
