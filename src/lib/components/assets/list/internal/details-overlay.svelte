<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState } from '@sveltia/ui';
  import { isTextFileType } from '@sveltia/utils/file';

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
  import { overlaidAsset } from '$lib/services/assets';
  import { deleteAssets } from '$lib/services/assets/data/delete';
  import { selectedAssetFolder } from '$lib/services/assets/folders';
  import { getAssetBlob } from '$lib/services/assets/info';
  import { isMediaKind } from '$lib/services/assets/kinds';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  /**
   * The blob most recently loaded, along with the asset it was loaded for. Kept together so the
   * preview never reads a blob that belongs to another asset: once an asset has been renamed or
   * moved on the file system, the blob read before the move points at a file that no longer exists.
   * @type {{ asset: Asset, blob: Blob } | undefined}
   */
  let loaded = $state.raw();

  const asset = $derived(overlaidAsset.current);
  const blob = $derived(loaded?.asset === asset ? /** @type {Blob} */ (loaded?.blob) : undefined);
  const kind = $derived(asset?.kind);
  const blobURL = $derived(asset?.blobURL);
  const name = $derived(asset?.name);
  const assets = $derived(asset ? [asset] : []);
  const backPath = $derived(`/assets/${selectedAssetFolder.current?.internalPath ?? '-/all'}`);

  $effect(() => {
    if (asset) {
      (async () => {
        const _blob = await getAssetBlob(asset);

        // The user may have switched to another asset in the meantime
        if (overlaidAsset.current === asset) {
          loaded = { asset, blob: _blob };
        }
      })();
    }
  });
</script>

<DetailsOverlay
  title={name}
  contentKey={asset?.sha}
  onBack={() => {
    goBack(backPath);
  }}
>
  {#snippet actions(useButton)}
    <CopyAssetsButton {assets} {useButton} />
    <DownloadAssetsButton {assets} getName={(a) => a.name} getBlob={getAssetBlob} {useButton} />
    <!--
      Deleting a file from the media library commits straight to the configured branch rather than
      going through review, so it’s not something an Open Authoring contributor can do
    -->
    <DeleteAssetsButton
      {assets}
      disabled={openAuthoring.current}
      deleteAssets={(_assets) => {
        // Don’t wait for the commit; the list is updated optimistically
        deleteAssets(_assets);
      }}
      buttonDescription={_('delete_assets', { values: { count: 1 } })}
      dialogDescription={_('confirm_deleting_this_asset')}
      onDelete={() => {
        goBack(backPath);
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
      />
    {:else if blob?.type === 'application/pdf'}
      <iframe src={blobURL} title={name} sandbox="allow-scripts"></iframe>
    {:else if blob?.type && isTextFileType(blob.type)}
      {#await asset.text ?? blob.text() then text}
        <TextPreview {text} name={name ?? ''} />
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
