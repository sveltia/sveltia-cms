<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, GridBody, InfiniteScroll } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';
  import { sleep } from '@sveltia/utils/misc';

  import AssetListItem from '$lib/components/assets/list/asset-list-item.svelte';
  import FolderItem from '$lib/components/assets/list/folder-item.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import UploadAssetsButton from '$lib/components/assets/toolbar/upload-assets-button.svelte';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import { uploadingAssets } from '$lib/services/assets';
  import {
    canCreateAsset,
    selectedAssetFolder,
    targetAssetFolder,
  } from '$lib/services/assets/folders';
  import { currentView, listedAssets } from '$lib/services/assets/view';
  import { filterAssets } from '$lib/services/assets/view/filter';
  import { groupAssets } from '$lib/services/assets/view/group';
  import { sortAssets } from '$lib/services/assets/view/sort';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  /**
   * @typedef {object} SubDirectory
   * @property {string} name Subdirectory name.
   * @property {string} path Subdirectory path relative to the base folder.
   */

  /**
   * @typedef {object} Props
   * @property {SubDirectory[]} [subDirectories] Subdirectories of the current folder.
   * @property {string} [currentSubPath] Current sub-path within the folder.
   * @property {(subDir: SubDirectory) => void} [onNavigateFolder] Called when a subdirectory is
   * clicked.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    subDirectories = [],
    currentSubPath = '',
    onNavigateFolder = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const viewType = $derived($currentView.type);
  const folder = $derived($targetAssetFolder);
  const uploadDisabled = $derived(!canCreateAsset(folder));

  const filteredAssets = $derived.by(() => {
    const selectedFolder = $selectedAssetFolder;
    const base = selectedFolder?.internalPath;

    if (!base) {
      return $listedAssets;
    }

    if (currentSubPath) {
      const expectedDir = `${base}/${currentSubPath}`;

      return $listedAssets.filter((asset) => getPathInfo(asset.path).dirname === expectedDir);
    }

    return $listedAssets.filter((asset) => {
      const dirname = getPathInfo(asset.path).dirname ?? '';

      return dirname === base;
    });
  });

  const groupedEntries = $derived.by(() => {
    let assets = [...filteredAssets];

    assets = sortAssets(assets, $currentView.sort);
    assets = filterAssets(assets, $currentView.filter);

    return Object.entries(groupAssets(assets, $currentView.group));
  });

  const showContent = $derived(subDirectories.length > 0 || filteredAssets.length > 0);
</script>

<ListContainer aria-label={_('asset_list')}>
  <DropZone
    disabled={uploadDisabled}
    multiple={true}
    onDrop={({ files }) => {
      $uploadingAssets = { folder, files, subPath: currentSubPath || undefined };
    }}
  >
    {#if showContent}
      <ListingGrid
        id="asset-list"
        {viewType}
        aria-label={_('assets')}
        aria-rowcount={$listedAssets.length}
      >
        {#await sleep() then}
          <GridBody>
            {#if subDirectories.length}
              {#each subDirectories as subDir (subDir.path)}
                <FolderItem
                  title={subDir.name}
                  onclick={() => onNavigateFolder?.(subDir)}
                  {viewType}
                />
              {/each}
            {/if}
            {#each groupedEntries as [name, assets] (name)}
              {#await sleep() then}
                <InfiniteScroll items={assets} itemKey="path">
                  {#snippet renderItem(/** @type {Asset} */ asset)}
                    {#key asset.sha}
                      {#await sleep() then}
                        <AssetListItem {asset} {viewType} />
                      {/await}
                    {/key}
                  {/snippet}
                </InfiniteScroll>
              {/await}
            {/each}
          </GridBody>
        {/await}
      </ListingGrid>
    {:else}
      <EmptyState>
        <span role="none">{_('no_files_found')}</span>
        {#if !uploadDisabled}
          <UploadAssetsButton label={_('upload_assets')} />
        {/if}
      </EmptyState>
    {/if}
  </DropZone>
</ListContainer>
