<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, EmptyState, Toast } from '@sveltia/ui';
  import { isTextFileType } from '@sveltia/utils/file';
  import { onDestroy, untrack } from 'svelte';

  import DeleteAssetsButton from '$lib/components/assets/list/delete-assets-button.svelte';
  import DetailsOverlay from '$lib/components/assets/list/details-overlay.svelte';
  import DownloadAssetsButton from '$lib/components/assets/list/download-assets-button.svelte';
  import CopyAssetsButton from '$lib/components/assets/list/internal/copy-assets-button.svelte';
  import EditOptionsButton from '$lib/components/assets/list/internal/edit-options-button.svelte';
  import InfoPanel from '$lib/components/assets/list/internal/info-panel.svelte';
  import TextPreview from '$lib/components/assets/list/text-preview.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import NotFound from '$lib/components/global/not-found.svelte';
  import { goBack } from '$lib/services/app/navigation';
  import { planAssetDeletion } from '$lib/services/assets/data/cascade';
  import { deleteAssets } from '$lib/services/assets/data/delete';
  import {
    assetsLocked,
    hasReadonlyAsset,
    selectedAssetFolder,
  } from '$lib/services/assets/folders';
  import { getAssetBlob, preloadAssets } from '$lib/services/assets/info';
  import { canPreviewAsset, isMediaKind } from '$lib/services/assets/kinds';
  import { getAssetFolderHistoryState, showAssetDetails } from '$lib/services/assets/navigation';
  import { overlaidAsset } from '$lib/services/assets/state';
  import { browsedDirPath } from '$lib/services/assets/subfolders';
  import { assetGroups, getAdjacentAssets } from '$lib/services/assets/view';
  import { isCommitCancelled } from '$lib/services/backends/commit-prompt';
  import { isSearchResultsPath } from '$lib/services/search/navigation';
  import { encodePathSegments } from '$lib/services/utils/url';

  /**
   * @import { ViewTransitionType } from '$lib/services/app/navigation';
   * @import { Asset } from '$lib/types/private';
   */

  /**
   * The blob most recently loaded, along with the asset it was loaded for. Kept together so the
   * preview never reads a blob that belongs to another asset: once an asset has been renamed or
   * moved on the file system, the blob read before the move points at a file that no longer exists.
   * @type {{ asset: Asset, blob: Blob } | undefined}
   */
  let loaded = $state.raw();
  let deletingFailed = $state(false);

  const asset = $derived(overlaidAsset.current);
  const blob = $derived(loaded?.asset === asset ? /** @type {Blob} */ (loaded?.blob) : undefined);
  const kind = $derived(asset?.kind);
  const blobURL = $derived(asset?.blobURL);
  const name = $derived(asset?.name ?? '');
  const assets = $derived(asset ? [asset] : []);
  // Back to the subfolder the asset was opened from, if the folder is browsed by subfolder
  const backPath = $derived(
    encodePathSegments(
      `/assets/${browsedDirPath.current ?? selectedAssetFolder.current?.internalPath ?? '-/all'}`,
    ),
  );
  /**
   * The assets right before and after the shown one in the list the overlay was opened from. An
   * asset that can’t be previewed isn’t opened in the overlay from the list, so it’s skipped.
   */
  const { previous, next } = $derived(
    getAdjacentAssets(
      Object.values(assetGroups.current)
        .flat(1)
        .filter((a) => a.path === asset?.path || canPreviewAsset(a)),
      (a) => a.path === asset?.path,
    ),
  );

  /**
   * Show another listed asset in place of the current one. The history entry is replaced, so the
   * browser’s back button still returns to the list however many assets have been flipped through.
   * @param {Asset} target Asset to be shown.
   * @param {ViewTransitionType} transitionType View transition type.
   */
  const showAsset = (target, transitionType) => {
    showAssetDetails(target, { replaceState: true, transitionType });
  };

  // Load the adjacent images ahead of time, so moving to one of them is instant. Other kinds aren’t
  // worth downloading in full on the off chance, e.g. a video. The shown asset is kept as well, so
  // the one just moved to isn’t released before its preview displays it
  $effect(() => {
    const targets = /** @type {Asset[]} */ ([previous, next].filter((a) => a?.kind === 'image'));
    const keep = asset ? [asset] : [];

    untrack(() => preloadAssets(targets, { keep }));
  });

  onDestroy(() => {
    preloadAssets([]);
  });

  $effect(() => {
    // Hold on to the asset, as the derived value follows the overlay while the blob is being read
    const current = asset;

    if (current) {
      (async () => {
        const _blob = await getAssetBlob(current);

        // The user may have switched to another asset in the meantime
        if (overlaidAsset.current === current) {
          loaded = { asset: current, blob: _blob };
        }
      })();
    }
  });
</script>

<DetailsOverlay
  title={name}
  contentKey={asset?.sha}
  onBack={() => {
    goBack(backPath, { returnTo: isSearchResultsPath, state: getAssetFolderHistoryState() });
  }}
  onPrevious={previous ? () => showAsset(previous, 'previous') : undefined}
  onNext={next ? () => showAsset(next, 'next') : undefined}
>
  {#snippet actions(useButton)}
    <CopyAssetsButton {assets} {useButton} />
    <DownloadAssetsButton {assets} getName={(a) => a.name} getBlob={getAssetBlob} {useButton} />
    <!--
      Deleting a file from the media library commits straight to the configured branch rather than
      going through review, so it’s not something an Open Authoring contributor or a user who
      can’t push to the branch can do
    -->
    <DeleteAssetsButton
      {assets}
      disabled={assetsLocked.current || hasReadonlyAsset(assets)}
      deleteAssets={async (_assets) => {
        try {
          await deleteAssets(_assets);
        } catch (/** @type {any} */ ex) {
          // The user has cancelled the commit at the commit message prompt, which isn’t a failure
          if (!isCommitCancelled(ex)) {
            deletingFailed = true;
            // eslint-disable-next-line no-console
            console.error(ex);
          }

          // Stay on the asset, which is still there
          return false;
        }

        return true;
      }}
      planDeletion={planAssetDeletion}
      buttonDescription={_('delete_assets', { values: { count: 1 } })}
      dialogDescription={_('confirm_deleting_this_asset')}
      onDelete={() => {
        goBack(backPath, { returnTo: isSearchResultsPath, state: getAssetFolderHistoryState() });
      }}
      {useButton}
    />
  {/snippet}
  {#snippet editOptions(extraItems)}
    <EditOptionsButton {asset} {extraItems} />
  {/snippet}
  {#snippet preview()}
    {#if !asset}
      <NotFound message={_('file_not_found')} {backPath} />
    {:else if kind && isMediaKind(kind)}
      <AssetPreview
        {kind}
        {asset}
        blurBackground={['image', 'video'].includes(kind)}
        checkerboard={kind === 'image'}
        alt={kind === 'image' ? name : undefined}
        controls={['audio', 'video'].includes(kind)}
        loading="eager"
        dissolve={false}
        holdTransition={true}
      />
    {:else if blob?.type === 'application/pdf'}
      <iframe src={blobURL} title={name} sandbox="allow-scripts"></iframe>
    {:else if blob?.type && isTextFileType(blob.type)}
      {#await asset.text ?? blob.text() then text}
        <TextPreview {text} {name} />
      {/await}
    {:else}
      <EmptyState>
        <span role="alert">{_('preview_unavailable')}</span>
      </EmptyState>
    {/if}
  {/snippet}
  {#snippet info()}
    {#if asset}
      <InfoPanel {asset} />
    {/if}
  {/snippet}
</DetailsOverlay>

<Toast bind:show={deletingFailed}>
  <Alert status="error">{_('deleting_assets_failed')}</Alert>
</Toast>
