<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';

  import RenameDialog from '$lib/components/assets/list/rename-dialog.svelte';
  import { goto, parseLocation } from '$lib/services/app/navigation';
  import { getAssetsByDirName } from '$lib/services/assets';
  import { moveAssets } from '$lib/services/assets/data/move';
  import { getAssetUsedEntries } from '$lib/services/assets/details';
  import { getAssetFolderHistoryState } from '$lib/services/assets/navigation';
  import { renamingAsset } from '$lib/services/assets/state';
  import { getFolderNamesInDir } from '$lib/services/assets/subfolders';
  import { isCommitCancelled } from '$lib/services/backends/commit-prompt';
  import { getReadonlyEntryLabel, isEntryReadonly } from '$lib/services/contents/entry/readonly';
  import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
  import { watchAsync } from '$lib/services/utils/state.svelte';
  import { encodePathSegments } from '$lib/services/utils/url';

  /**
   * @import { Entry } from '$lib/types/private';
   */

  let open = $state(false);
  let renamingFailed = $state(false);
  /** @type {Entry[]} */
  let usedEntries = $state([]);

  const asset = $derived(renamingAsset.current);
  // A read-only entry using the asset can’t be updated along with the rename, so the rename is
  // refused up front rather than when it’s about to be committed
  const readonlyEntries = $derived(usedEntries.filter((entry) => isEntryReadonly(entry)));
  const blockedMessage = $derived(
    readonlyEntries.length
      ? _('cannot_move_referenced_asset', {
          values: {
            entries: readonlyEntries.map((entry) => getReadonlyEntryLabel(entry)).join(', '),
          },
        })
      : undefined,
  );
  const { dirname = '', basename = '' } = $derived(getPathInfo(asset?.path ?? ''));
  const otherNames = $derived(
    asset
      ? getAssetsByDirName(dirname)
          .map((a) => a.name)
          .filter((n) => n !== asset.name)
      : [],
  );
  /** Names of the subfolders next to the asset, which a file can’t take either. */
  const folderNames = $derived(asset ? getFolderNamesInDir(dirname) : []);

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
    const newPath = `${dirname}/${newName}`;

    try {
      await moveAssets('rename', [{ asset, path: newPath }]);
    } catch (/** @type {any} */ ex) {
      // The user has cancelled the commit at the commit message prompt, which isn’t a failure
      if (!isCommitCancelled(ex)) {
        renamingFailed = true;
        // eslint-disable-next-line no-console
        console.error(ex);
      }

      return;
    }

    if (parseLocation().path === `/assets/${oldPath}`) {
      await goto(encodePathSegments(`/assets/${newPath}`), {
        replaceState: true,
        notifyChange: false,
        // Keep the folder the asset was opened from, e.g. All Assets
        state: getAssetFolderHistoryState(),
      });
    }
  };

  // Another asset can be renamed before the entries using this one are found, which `watchAsync`
  // takes care of
  watchAsync(
    () => (asset ? getAssetUsedEntries(asset) : undefined),
    (entries) => {
      usedEntries = entries;
      open = true;
    },
  );
</script>

<RenameDialog
  bind:open
  name={basename}
  {otherNames}
  {folderNames}
  usedEntryCount={usedEntries.length}
  {blockedMessage}
  slugificationEnabled={getDefaultMediaLibraryOptions().config.slugify_filename}
  onRename={renameAsset}
  onClose={() => {
    renamingAsset.current = undefined;
  }}
/>

<Toast bind:show={renamingFailed}>
  <Alert status="error">{_('renaming_asset_failed')}</Alert>
</Toast>
