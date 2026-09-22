<script>
  import { _ } from '@sveltia/i18n';
  import { sleep } from '@sveltia/utils/misc';

  import AssetListContainer from '$lib/components/assets/list/asset-list-container.svelte';
  import AssetListItem from '$lib/components/assets/list/internal/asset-list-item.svelte';
  import SubfolderListItem from '$lib/components/assets/list/internal/subfolder-list-item.svelte';
  import UploadAssetsButton from '$lib/components/assets/list/internal/upload-assets-button.svelte';
  import { focusedAsset, uploadingAssets } from '$lib/services/assets';
  import { canCreateAsset, targetAssetFolder } from '$lib/services/assets/folders';
  import { focusedSubfolder, selectedSubfolderPath } from '$lib/services/assets/subfolders';
  import { assetGroups, listedAssets, listedSubfolders } from '$lib/services/assets/view';
  import { currentView } from '$lib/services/assets/view/settings';
  import { openAuthoring } from '$lib/services/workflow/open-authoring';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  const viewType = $derived(currentView.current.type);
  const folder = $derived(targetAssetFolder.current);
  const subfolderCount = $derived(listedSubfolders.current.length);
  // Uploading to the media library commits straight to the configured branch rather than going
  // through review, so it’s not something an Open Authoring contributor can do. An asset attached
  // to an entry is committed with that entry, so it’s unaffected
  const uploadDisabled = $derived(openAuthoring.current || !canCreateAsset(folder));
</script>

<AssetListContainer
  groups={assetGroups.current}
  itemKey="path"
  totalCount={subfolderCount + listedAssets.current.length}
  {viewType}
  {uploadDisabled}
  hasSubfolders={!!subfolderCount}
  onDrop={(files) => {
    uploadingAssets.current = { folder, subfolderPath: selectedSubfolderPath.current, files };
  }}
  onBlankClick={() => {
    // Show the info of the folder being browsed in place of an asset’s or a subfolder’s
    focusedAsset.current = undefined;
    focusedSubfolder.current = undefined;
  }}
>
  {#snippet subfolders()}
    {#each listedSubfolders.current as subfolder, index (subfolder.path)}
      <SubfolderListItem {subfolder} rowIndex={index} {viewType} />
    {/each}
  {/snippet}
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
