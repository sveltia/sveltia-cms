<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, Icon, InfiniteScroll } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';
  import { sleep } from '@sveltia/utils/misc';
  import { stripSlashes } from '@sveltia/utils/string';

  import AssetPath from '$lib/components/assets/browser/asset-path.svelte';
  import SimpleImageGridItem from '$lib/components/assets/browser/simple-image-grid-item.svelte';
  import SimpleImageGrid from '$lib/components/assets/browser/simple-image-grid.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import UploadAssetsButton from '$lib/components/assets/toolbar/upload-assets-button.svelte';
  import ListContainer from '$lib/components/common/list-container.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { focusedAsset, uploadingAssets, selectedAssets, selectedAssetPathSet } from '$lib/services/assets';
  import { canCreateAsset, selectedAssetFolder, targetAssetFolder } from '$lib/services/assets/folders';
  import { currentView, listedAssets } from '$lib/services/assets/view';
  import { isSmallScreen } from '$lib/services/user/env';

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
   * @property {() => void} [onNavigateUp] Called when the "go up" button is clicked.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    subDirectories = [],
    currentSubPath = '',
    onNavigateFolder = undefined,
    onNavigateUp = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const viewType = $derived($currentView.type);
  const folder = $derived($targetAssetFolder);
  const uploadDisabled = $derived(!canCreateAsset(folder));
  const isRootLevel = $derived(!currentSubPath);

  const basePath = $derived($targetAssetFolder?.internalPath);

  const filteredAssets = $derived.by(() => {
    const selectedFolder = $selectedAssetFolder;
    const base = selectedFolder?.internalPath;

    // All Assets is a virtual folder — show all assets flat.
    if (!base) {
      return $listedAssets;
    }

    if (currentSubPath) {
      const expectedDir = `${base}/${currentSubPath}`;
      return $listedAssets.filter((asset) => getPathInfo(asset.path).dirname === expectedDir);
    }

    // At root level, only show files directly in this folder, not in subdirectories.
    return $listedAssets.filter((asset) => {
      const dirname = getPathInfo(asset.path).dirname ?? '';
      return dirname === base;
    });
  });

  const showContent = $derived(subDirectories.length > 0 || filteredAssets.length > 0);

  /**
   * Toggle file selection and set the focused asset.
   * @param {Asset} asset Asset.
   * @param {boolean} selected Whether selected.
   */
  const toggleSelection = (asset, selected) => {
    if (selected) {
      $focusedAsset = asset;
    }

    selectedAssets.update((assets) => {
      const idx = assets.indexOf(asset);

      if (selected && idx === -1) {
        assets.push(asset);
      } else if (!selected && idx > -1) {
        assets.splice(idx, 1);
      }

      return assets;
    });
  };

  /**
   * Open asset detail on double-click.
   * @param {Asset} asset Asset.
   */
  const openAssetDetail = (asset) => {
    if (asset.kind !== 'other') {
      goto(`/assets/${asset.path}`, { transitionType: 'forwards' });
    }
  };
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
      <div role="none" class="grid-wrapper">
        <SimpleImageGrid {viewType} showTitle={true}>
          {#if subDirectories.length}
            {#if !isRootLevel && onNavigateUp}
              <SimpleImageGridItem
                value=".."
                {viewType}
                multiple={false}
                selected={false}
                onChange={() => onNavigateUp()}
              >
                <span role="none" class="dir-preview {viewType}">
                  <Icon name="arrow_upward" />
                </span>
                <AssetPath path=".." />
              </SimpleImageGridItem>
            {/if}
            {#each subDirectories as subDir (subDir.path)}
              <SimpleImageGridItem
                value={subDir.path}
                {viewType}
                multiple={false}
                selected={false}
                onChange={() => onNavigateFolder?.(subDir)}
              >
                <span role="none" class="dir-preview {viewType}">
                  <Icon name="folder" />
                </span>
                <AssetPath path={subDir.name} />
              </SimpleImageGridItem>
            {/each}
          {/if}
          {#if filteredAssets.length}
            <InfiniteScroll items={filteredAssets} itemKey="path">
              {#snippet renderItem(/** @type {Asset} */ asset)}
                {#await sleep() then}
                  {@const { kind, name, path } = asset}
                  {@const relPath =
                    basePath ? stripSlashes(path.replace(basePath, '')) : name}
                  <SimpleImageGridItem
                    value={path}
                    {viewType}
                    multiple={true}
                    selected={$selectedAssetPathSet.has(path)}
                    onChange={({ detail: { selected } }) => toggleSelection(asset, selected)}
                  >
                    <div
                      role="none"
                      ondblclick={() => openAssetDetail(asset)}
                    >
                      <AssetPreview {kind} {asset} alt={relPath} variant="tile" checkerboard={kind === 'image'} />
                    </div>
                    {#if !$isSmallScreen || viewType === 'list'}
                      <AssetPath path={relPath} />
                    {/if}
                  </SimpleImageGridItem>
                {/await}
              {/snippet}
            </InfiniteScroll>
          {/if}
        </SimpleImageGrid>
      </div>
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

<style lang="scss">
  .grid-wrapper {
    overflow-y: auto;
    height: 100%;

    :global([role='listbox']) {
      background-color: transparent;
    }

    .dir-preview {
      display: flex;
      align-items: center;
      justify-content: center;
      aspect-ratio: 1 / 1;
      border: 1px solid var(--sui-control-border-color);
      border-radius: var(--sui-control-medium-border-radius);
      background-color: var(--sui-secondary-background-color);
      width: 100%;

      :global(.icon) {
        font-size: 48px;
        color: var(--sui-secondary-foreground-color);
        opacity: 0.6;
      }

      &.list {
        width: 64px;
        aspect-ratio: unset;
        height: 64px;
        flex: none;

        :global(.icon) {
          font-size: 24px;
        }
      }
    }
  }
</style>
