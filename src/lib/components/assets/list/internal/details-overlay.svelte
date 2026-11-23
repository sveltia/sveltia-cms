<script>
  import { _ } from '@sveltia/i18n';
  import { onDestroy, untrack } from 'svelte';

  import AssetPreviewContent from '$lib/components/assets/list/asset-preview-content.svelte';
  import DetailsOverlay from '$lib/components/assets/list/details-overlay.svelte';
  import DownloadAssetsButton from '$lib/components/assets/list/download-assets-button.svelte';
  import CopyAssetsButton from '$lib/components/assets/list/internal/copy-assets-button.svelte';
  import DeleteAssetsButton from '$lib/components/assets/list/internal/delete-assets-button.svelte';
  import EditOptionsButton from '$lib/components/assets/list/internal/edit-options-button.svelte';
  import InfoPanel from '$lib/components/assets/list/internal/info-panel.svelte';
  import NotFound from '$lib/components/global/not-found.svelte';
  import { goBack } from '$lib/services/app/navigation';
  import { selectedAssetFolder } from '$lib/services/assets/folders';
  import { getAssetBlob, preloadAssets } from '$lib/services/assets/info';
  import { canPreviewAsset } from '$lib/services/assets/kinds';
  import { getAssetFolderHistoryState, showAssetDetails } from '$lib/services/assets/navigation';
  import { overlaidAsset } from '$lib/services/assets/state';
  import { browsedDirPath } from '$lib/services/assets/subfolders';
  import { assetGroups, getAdjacentAssets } from '$lib/services/assets/view';
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
   * The blob is missing if it couldn’t be read.
   * @type {{ asset: Asset, blob?: Blob } | undefined}
   */
  let loaded = $state.raw();

  const asset = $derived(overlaidAsset.current);
  /** Whether the blob of the shown asset is still being read. */
  const pending = $derived(loaded?.asset !== asset);
  /* v8 ignore start -- only read while the asset is shown, by which time `loaded` is set */
  const blob = $derived(pending ? undefined : loaded?.blob);
  /* v8 ignore stop */
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
  /** The assets right before and after the shown one in the list the overlay was opened from. */
  const { previous, next } = $derived(
    getAdjacentAssets(assetGroups.current, (a) => a.path === asset?.path, canPreviewAsset),
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
        /** @type {Blob | undefined} */
        let _blob;

        try {
          _blob = await getAssetBlob(current);
        } catch (/** @type {any} */ ex) {
          // The preview is shown as unavailable
          // eslint-disable-next-line no-console
          console.error(ex);
        }

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
    <DeleteAssetsButton
      {assets}
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
    {:else}
      <AssetPreviewContent
        {kind}
        {name}
        type={blob?.type}
        {asset}
        src={blobURL}
        {pending}
        getText={() => asset.text ?? /** @type {Blob} */ (blob).text()}
      />
    {/if}
  {/snippet}
  {#snippet info()}
    {#if asset}
      <InfoPanel {asset} />
    {/if}
  {/snippet}
</DetailsOverlay>
