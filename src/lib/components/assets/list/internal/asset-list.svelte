<script>
  import { _ } from '@sveltia/i18n';
  import { sleep } from '@sveltia/utils/misc';

  import AssetListContainer from '$lib/components/assets/list/asset-list-container.svelte';
  import AssetListItem from '$lib/components/assets/list/internal/asset-list-item.svelte';
  import UploadAssetsButton from '$lib/components/assets/list/internal/upload-assets-button.svelte';
  import { uploadingAssets } from '$lib/services/assets';
  import { canCreateAsset, targetAssetFolder } from '$lib/services/assets/folders';
  import { assetGroups, listedAssets } from '$lib/services/assets/view';
  import { currentView } from '$lib/services/assets/view/settings';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  const viewType = $derived(currentView.current.type);
  const folder = $derived(targetAssetFolder.current);
  // Uploading to the media library commits straight to the configured branch rather than going
  // through review, so it’s not something an Open Authoring contributor can do. An asset attached
  // to an entry is committed with that entry, so it’s unaffected
  const uploadDisabled = $derived(openAuthoring.current || !canCreateAsset(folder));
</script>

<AssetListContainer
  groups={assetGroups.current}
  itemKey="path"
  totalCount={listedAssets.current.length}
  {viewType}
  {uploadDisabled}
  onDrop={(files) => {
    uploadingAssets.current = { folder, files };
  }}
>
  {#snippet renderItem(/** @type {Asset} */ asset)}
    {#key asset.sha}
      {#await sleep() then}
        <AssetListItem {asset} {viewType} />
      {/await}
    {/key}
  {/snippet}
  {#snippet emptyAction()}
    <UploadAssetsButton label={_('upload_assets')} />
  {/snippet}
</AssetListContainer>
