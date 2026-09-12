<!--
  @component
  Details overlay for an asset on a cloud storage service. The file is previewed straight from the
  service’s URL, so a text file can only be shown when the service allows cross-origin requests.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState } from '@sveltia/ui';
  import { isTextFileType } from '@sveltia/utils/file';
  import mime from 'mime';

  import DeleteAssetsButton from '$lib/components/assets/list/delete-assets-button.svelte';
  import DetailsOverlay from '$lib/components/assets/list/details-overlay.svelte';
  import DownloadAssetsButton from '$lib/components/assets/list/download-assets-button.svelte';
  import CopyAssetsButton from '$lib/components/assets/list/external/copy-assets-button.svelte';
  import EditOptionsButton from '$lib/components/assets/list/external/edit-options-button.svelte';
  import InfoPanel from '$lib/components/assets/list/external/info-panel.svelte';
  import TextPreview from '$lib/components/assets/list/text-preview.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import NotFound from '$lib/components/global/not-found.svelte';
  import { goBack, goto } from '$lib/services/app/navigation';
  import {
    externalAssets,
    getCloudServicePath,
    getExternalAssetPath,
    overlaidExternalAssetId,
    selectedCloudService,
  } from '$lib/services/assets/external';
  import { deleteExternalAssets, fetchExternalAssetBlob } from '$lib/services/assets/external/data';
  import { listedExternalAssets } from '$lib/services/assets/external/view';
  import { isMediaKind } from '$lib/services/assets/kinds';
  import { getAdjacentAssets } from '$lib/services/assets/view';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { ViewTransitionType } from '$lib/services/app/navigation';
   * @import { ExternalAsset, MediaLibraryService } from '$lib/types/private';
   */

  /** The component is only rendered while a service is selected. */
  const service = $derived(/** @type {MediaLibraryService} */ (selectedCloudService.current));
  /** Whether the asset list has been loaded, so the asset can be looked up. */
  const loaded = $derived(!!externalAssets.current);
  const asset = $derived(
    externalAssets.current?.find(({ id }) => id === overlaidExternalAssetId.current),
  );
  const kind = $derived(asset?.kind);
  const fileName = $derived(asset?.fileName ?? '');
  const downloadURL = $derived(asset?.downloadURL ?? '');
  const type = $derived(mime.getType(fileName));
  const assets = $derived(asset ? [asset] : []);
  const backPath = $derived(getCloudServicePath(service));
  /** The assets right before and after the shown one in the list the overlay was opened from. */
  const { previous, next } = $derived(
    getAdjacentAssets(listedExternalAssets.current, ({ id }) => id === asset?.id),
  );

  /**
   * Show another listed asset in place of the current one. The history entry is replaced, so the
   * browser’s back button still returns to the list however many assets have been flipped through.
   * @param {ExternalAsset} target Asset to be shown.
   * @param {ViewTransitionType} transitionType View transition type.
   */
  const showAsset = (target, transitionType) => {
    goto(getExternalAssetPath(service, target), { replaceState: true, transitionType });
  };
</script>

<DetailsOverlay
  title={fileName}
  contentKey={asset?.id}
  onBack={() => {
    goBack(backPath);
  }}
  onPrevious={previous ? () => showAsset(previous, 'previous') : undefined}
  onNext={next ? () => showAsset(next, 'next') : undefined}
>
  {#snippet actions(useButton)}
    <CopyAssetsButton {assets} {useButton} />
    <DownloadAssetsButton
      {assets}
      getName={(a) => a.fileName}
      getBlob={fetchExternalAssetBlob}
      {useButton}
    />
    {#if service.delete}
      <DeleteAssetsButton
        {assets}
        deleteAssets={deleteExternalAssets}
        buttonDescription={_('delete_assets', { values: { count: 1 } })}
        dialogDescription={_('confirm_deleting_this_asset')}
        onDelete={() => {
          goBack(backPath);
        }}
        {useButton}
      />
    {/if}
  {/snippet}
  {#snippet editOptions(extraItems)}
    <!-- On small screens, the menu also holds the other actions, so it’s always needed there -->
    {#if service.rename || service.replace || env.isSmallScreen}
      <EditOptionsButton {asset} {extraItems} />
    {/if}
  {/snippet}
  {#snippet preview()}
    {#if !loaded}
      <EmptyState>
        <span role="alert">{_('loading')}</span>
      </EmptyState>
    {:else if !asset || !kind}
      <NotFound message={_('file_not_found')} {backPath} />
    {:else if isMediaKind(kind)}
      <AssetPreview
        {kind}
        src={downloadURL}
        blurBackground={['image', 'video'].includes(kind)}
        checkerboard={kind === 'image'}
        alt={kind === 'image' ? fileName : undefined}
        controls={['audio', 'video'].includes(kind)}
      />
    {:else if type === 'application/pdf'}
      <iframe src={downloadURL} title={fileName} sandbox="allow-scripts"></iframe>
    {:else if type && isTextFileType(type)}
      {#await fetchExternalAssetBlob(asset).then((blob) => blob.text())}
        <EmptyState>
          <span role="alert">{_('loading')}</span>
        </EmptyState>
      {:then text}
        <TextPreview {text} name={fileName} />
      {:catch}
        <EmptyState>
          <span role="alert">{_('preview_unavailable')}</span>
        </EmptyState>
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
