<script>
  import { _, locale as appLocale } from '@sveltia/i18n';

  import DeleteAssetsButton from '$lib/components/assets/list/delete-assets-button.svelte';
  import DownloadAssetsButton from '$lib/components/assets/list/download-assets-button.svelte';
  import CopyAssetsButton from '$lib/components/assets/list/internal/copy-assets-button.svelte';
  import EditOptionsButton from '$lib/components/assets/list/internal/edit-options-button.svelte';
  import NewSubfolderButton from '$lib/components/assets/list/internal/new-subfolder-button.svelte';
  import UploadAssetsButton from '$lib/components/assets/list/internal/upload-assets-button.svelte';
  import PreviewAssetButton from '$lib/components/assets/list/preview-asset-button.svelte';
  import PrimaryToolbar from '$lib/components/assets/list/primary-toolbar.svelte';
  import { goBack, goto } from '$lib/services/app/navigation';
  import { focusedAsset, selectedAssets } from '$lib/services/assets';
  import { planAssetDeletion } from '$lib/services/assets/data/cascade';
  import { deleteAssets } from '$lib/services/assets/data/delete';
  import {
    canCreateAsset,
    selectedAssetFolder,
    targetAssetFolder,
  } from '$lib/services/assets/folders';
  import { getAssetBlob } from '$lib/services/assets/info';
  import { canPreviewAsset } from '$lib/services/assets/kinds';
  import { selectedSubfolderPath } from '$lib/services/assets/subfolders';
  import { getFolderLabelByCollection, listedAssets } from '$lib/services/assets/view';
  import { env } from '$lib/services/user/env.svelte';
  import { createPath } from '$lib/services/utils/file';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  const folder = $derived(selectedAssetFolder.current);
  // `appLocale.current` is a key, because `getFolderLabelByCollection` can return a localized label
  const folderLabel = $derived(
    appLocale.current && folder ? getFolderLabelByCollection(folder) : '',
  );
  /** Names of the subfolders leading to the one being browsed, from the folder root down. */
  const subfolderNames = $derived(
    selectedSubfolderPath.current ? selectedSubfolderPath.current.split('/') : [],
  );
  /** The subfolder being browsed is the title; at the folder root, the folder itself is. */
  const title = $derived(subfolderNames.at(-1) ?? folderLabel);
  const asset = $derived(focusedAsset.current);

  const assets = $derived.by(() => {
    if (selectedAssets.current.length) return [...selectedAssets.current];
    if (asset) return [asset];
    return [];
  });

  // Uploading to the media library commits straight to the configured branch rather than going
  // through review, so it’s not something an Open Authoring contributor can do. An asset attached
  // to an entry is committed with that entry, so it’s unaffected
  const uploadDisabled = $derived(
    openAuthoring.current || !canCreateAsset(targetAssetFolder.current),
  );

  /**
   * Browse an ancestor of the subfolder being browsed. The selected asset folder travels as history
   * state, the same way it does from the sidebar, so the page can tell it from another folder
   * sharing its path.
   * @param {number} depth How many subfolder names to keep, `0` being the folder root.
   * @param {boolean} [back] Whether to go back in the history if the ancestor is the previous
   * page, as the back button on small screens does.
   */
  const browseAncestor = (depth, back = false) => {
    const path = `/assets/${createPath([folder?.internalPath, ...subfolderNames.slice(0, depth)])}`;
    const options = { transitionType: /** @type {const} */ ('backwards'), state: { folder } };

    if (back) {
      goBack(path, options);
    } else {
      goto(path, options);
    }
  };

  /** Ancestor folders of the subfolder being browsed, each leading back to itself. */
  const breadcrumbs = $derived(
    subfolderNames.length
      ? [folderLabel, ...subfolderNames.slice(0, -1)].map((label, depth) => ({
          label,
          // eslint-disable-next-line jsdoc/require-jsdoc
          onClick: () => browseAncestor(depth),
        }))
      : [],
  );
</script>

<PrimaryToolbar
  {title}
  {breadcrumbs}
  backLabel={subfolderNames.length ? _('back_to_parent_folder') : undefined}
  onBack={subfolderNames.length ? () => browseAncestor(subfolderNames.length - 1, true) : undefined}
>
  {#snippet actions()}
    <PreviewAssetButton
      path={asset ? `/assets/${asset.path}` : undefined}
      disabled={!asset || !canPreviewAsset(asset)}
    />
    <CopyAssetsButton assets={asset ? [asset] : []} />
    <DownloadAssetsButton {assets} getName={(a) => a.name} getBlob={getAssetBlob} />
    <!--
        Deleting a file from the media library commits straight to the configured branch rather
        than going through review, so it’s not something an Open Authoring contributor can do
      -->
    <DeleteAssetsButton
      {assets}
      disabled={openAuthoring.current}
      deleteAssets={(_assets) => {
        // Don’t wait for the commit; the list is updated optimistically
        deleteAssets(_assets);
      }}
      planDeletion={planAssetDeletion}
      buttonDescription={_('delete_selected_assets', { values: { count: assets.length } })}
      dialogDescription={_(
        assets.length > 1 && assets.length === listedAssets.current.length
          ? 'confirm_deleting_all_assets'
          : 'confirm_deleting_selected_assets',
        { values: { count: assets.length } },
      )}
    />
    <EditOptionsButton {asset} />
  {/snippet}
  {#snippet fab()}
    <!-- A folder-level action like Upload, so it sits with the Upload button on every screen size
    rather than with the asset actions, which are hidden on medium screens -->
    <NewSubfolderButton />
    {#if !env.isSmallScreen || (listedAssets.current.length && !uploadDisabled)}
      <UploadAssetsButton label={env.isSmallScreen ? undefined : _('upload')} />
    {/if}
  {/snippet}
</PrimaryToolbar>
