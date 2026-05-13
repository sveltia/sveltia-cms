<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Alert, Button, Icon, Toast } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';
  import { sleep } from '@sveltia/utils/misc';
  import equal from 'fast-deep-equal';
  import { onMount } from 'svelte';

  import AssetDetailsOverlay from '$lib/components/assets/details/asset-details-overlay.svelte';
  import CreateFolderDialog from '$lib/components/assets/shared/create-folder-dialog.svelte';
  import EditAssetDialog from '$lib/components/assets/details/edit-asset-dialog.svelte';
  import RenameAssetDialog from '$lib/components/assets/details/rename-asset-dialog.svelte';
  import AssetList from '$lib/components/assets/list/asset-list.svelte';
  import PrimarySidebar from '$lib/components/assets/list/primary-sidebar.svelte';
  import PrimaryToolbar from '$lib/components/assets/list/primary-toolbar.svelte';
  import SecondarySidebar from '$lib/components/assets/list/secondary-sidebar.svelte';
  import SecondaryToolbar from '$lib/components/assets/list/secondary-toolbar.svelte';
  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import SearchMainArea from '$lib/components/search/search-main-area.svelte';
  import {
    announcedPageStatus,
    goto,
    parseLocation,
    updateContentFromHashChange,
  } from '$lib/services/app/navigation';
  import { allAssets, getAssetSubDirectories, overlaidAsset } from '$lib/services/assets';
  import { assetUpdatesToast } from '$lib/services/assets/data';
  import { allAssetFolders, canCreateAsset, selectedAssetFolder } from '$lib/services/assets/folders';
  import {
    currentAssetSubPath,
    getFolderLabelByCollection,
    listedAssets,
    showAssetOverlay,
  } from '$lib/services/assets/view';
  import { isSearchRoute } from '$lib/services/search/navigation';
  import { isSmallScreen } from '$lib/services/user/env';

  const ROUTE_REGEX = /^\/assets(?:\/(?<folderPath>.+?)(?:\/(?<fileName>[^/]+\.[A-Za-z0-9]+))?)?$/;

  let isIndexPage = $state(false);
  let isSearchPage = $state(false);

  /** @type {string} */
  let currentSubPath = $state('');
  let showCreateFolderDialog = $state(false);

  const subDirectories = $derived.by(() => {
    void $allAssets;

    return getAssetSubDirectories($selectedAssetFolder, currentSubPath);
  });

  const breadcrumbSegments = $derived(
    currentSubPath ? ['', ...currentSubPath.split('/')] : [''],
  );

  const canCreateInFolder = $derived(canCreateAsset($selectedAssetFolder));

  $effect(() => {
    $currentAssetSubPath = currentSubPath;
  });

  /**
   * Navigate to a subfolder path.
   * @param {string} subPath Subfolder path relative to folder root.
   */
  const navigateToSubPath = (subPath) => {
    currentSubPath = subPath ?? '';
  };

  /**
   * Navigate up one directory level.
   */
  const navigateUp = () => {
    const segments = currentSubPath.split('/');

    segments.pop();
    currentSubPath = segments.join('/');
  };

  /**
   * Navigate to a specific breadcrumb segment.
   * @param {number} index Index of the segment to navigate to.
   */
  const navigateToSegment = (index) => {
    if (index === 0) {
      currentSubPath = '';
    } else {
      currentSubPath = breadcrumbSegments.slice(1, index + 1).join('/');
    }
  };

  const selectedAssetFolderLabel = $derived(
    // `appLocale.current` is a key, because `getFolderLabelByCollection` can return a localized
    // label
    appLocale.current && $selectedAssetFolder
      ? getFolderLabelByCollection($selectedAssetFolder)
      : '',
  );

  const filteredListedAssets = $derived.by(() => {
    if (!currentSubPath || !$selectedAssetFolder) {
      return $listedAssets;
    }

    const base = $selectedAssetFolder.internalPath ?? '';
    const expectedDir = base ? `${base}/${currentSubPath}` : currentSubPath;

    return $listedAssets.filter((asset) => getPathInfo(asset.path).dirname === expectedDir);
  });

  /**
   * Navigate to the asset list or asset details page given the URL hash.
   * @todo Show Not Found page.
   */
  const navigate = async () => {
    const { path } = parseLocation();
    const match = path.match(ROUTE_REGEX);

    isIndexPage = false;
    isSearchPage = false;

    if (!match?.groups) {
      $showAssetOverlay = false;
      // Check if it’s the search page, which has a different URL pattern (`#/search/{query}`)
      isSearchPage = isSearchRoute(path);

      return; // Different page
    }

    const { folderPath, fileName } = match.groups;

    if (!folderPath) {
      if ($isSmallScreen) {
        // Show the asset folder list only
        $selectedAssetFolder = undefined;
        $showAssetOverlay = false;
        $announcedPageStatus = _('viewing_asset_folder_list');
        isIndexPage = true;
      } else {
        // Redirect to All Assets
        goto('/assets/-/all');
      }

      return;
    }

    const folder =
      window.history.state?.folder ??
      $allAssetFolders.find(({ internalPath, collectionName }) =>
        folderPath === '-/all'
          ? internalPath === undefined && collectionName === undefined
          : internalPath === folderPath,
      );

    if (!folder) {
      // Not found
      $selectedAssetFolder = undefined;
    } else if (!equal($selectedAssetFolder, folder)) {
      $selectedAssetFolder = folder;
      currentSubPath = '';
    }

    if (!fileName) {
      // Wait for `selectedAssetFolderLabel` to be updated
      await sleep(100);

      $showAssetOverlay = false;
      $announcedPageStatus = _('viewing_x_asset_folder', {
        values: {
          folder: selectedAssetFolderLabel,
          count: $listedAssets.length,
        },
      });

      return;
    }

    $overlaidAsset = fileName
      ? $allAssets.find((asset) => asset.path === `${folderPath}/${fileName}`)
      : undefined;
    $announcedPageStatus = $overlaidAsset
      ? _('viewing_x_asset_details', { values: { name: $overlaidAsset.name } })
      : _('file_not_found');
    $showAssetOverlay = true;
  };

  onMount(() => {
    navigate();

    return () => {
      $showAssetOverlay = false;
    };
  });
</script>

<svelte:window
  onhashchange={(event) => {
    updateContentFromHashChange(event, navigate, ROUTE_REGEX);
  }}
/>

<PageContainer aria-label={_('asset_library')}>
  {#snippet primarySidebar()}
    {#if !$isSmallScreen || isIndexPage}
      <PrimarySidebar
        {isSearchPage}
        onSelect={() => {
          currentSubPath = '';
        }}
      />
    {/if}
  {/snippet}
  {#snippet main()}
    {#if isSearchPage}
      <SearchMainArea />
    {:else if !$isSmallScreen || !isIndexPage}
      <PageContainerMainArea
        id="assets-container"
        aria-label={_('x_asset_folder', { values: { folder: selectedAssetFolderLabel } })}
      >
        {#snippet primaryToolbar()}
          <PrimaryToolbar />
        {/snippet}
        {#snippet secondaryToolbar()}
          {#if filteredListedAssets.length}
            <SecondaryToolbar filteredAssets={filteredListedAssets} />
          {/if}
        {/snippet}
        {#snippet mainContent()}
          {#if $selectedAssetFolder}
            <!-- Breadcrumb -->
            <div role="navigation" class="breadcrumb" aria-label="Folder navigation">
              <span class="segments">
                {#each breadcrumbSegments as segment, index}
                  {#if index > 0}
                    <Icon name="chevron_right" />
                  {/if}
                  <button
                    class="crumb"
                    class:active={index === breadcrumbSegments.length - 1}
                    onclick={() => navigateToSegment(index)}
                  >
                    {index === 0
                      ? getFolderLabelByCollection($selectedAssetFolder)
                      : decodeURIComponent(segment)}
                  </button>
                {/each}
              </span>
              {#if currentSubPath}
                <Button
                  variant="text"
                  size="small"
                  label={_('go_up')}
                  onclick={navigateUp}
                />
              {/if}
              {#if canCreateInFolder}
                <Button
                  variant="text"
                  size="small"
                  label={_('assets_dialog.create_folder')}
                  onclick={() => { showCreateFolderDialog = true; }}
                />
              {/if}
            </div>
          {/if}
          <AssetList
            {subDirectories}
            {currentSubPath}
            onNavigateFolder={(subDir) => navigateToSubPath(subDir.path)}
            onNavigateUp={currentSubPath ? navigateUp : undefined}
          />
        {/snippet}
        {#snippet secondarySidebar()}
          <SecondarySidebar />
        {/snippet}
      </PageContainerMainArea>
    {/if}
  {/snippet}
</PageContainer>

{#if $showAssetOverlay}
  <AssetDetailsOverlay />
{/if}

<EditAssetDialog />
<RenameAssetDialog />

<Toast bind:show={$assetUpdatesToast.saved}>
  <Alert status="success">
    {_($assetUpdatesToast.published ? 'assets_saved_and_published' : 'assets_saved', {
      values: { count: $assetUpdatesToast.count },
    })}
  </Alert>
</Toast>

<Toast bind:show={$assetUpdatesToast.moved}>
  <Alert status="success">
    {_('assets_moved', { values: { count: $assetUpdatesToast.count } })}
  </Alert>
</Toast>

<Toast bind:show={$assetUpdatesToast.renamed}>
  <Alert status="success">
    {_('assets_renamed', { values: { count: $assetUpdatesToast.count } })}
  </Alert>
</Toast>

<Toast bind:show={$assetUpdatesToast.deleted}>
  <Alert status="success">
    {_('assets_deleted', { values: { count: $assetUpdatesToast.count } })}
  </Alert>
</Toast>

<CreateFolderDialog
  open={showCreateFolderDialog}
  parentFolder={$selectedAssetFolder}
  currentSubPath={currentSubPath}
  onClose={() => {
    showCreateFolderDialog = false;
  }}
/>

<style lang="scss">
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-bottom: 1px solid var(--sui-control-border-color);

    .segments {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: auto;

      .crumb {
        cursor: pointer;
        border: none;
        border-radius: 4px;
        padding: 2px 6px;
        color: var(--sui-link-color);
        background: none;
        font-size: var(--sui-font-size-small);
        font-family: inherit;

        &:hover {
          text-decoration: underline;
        }

        &.active {
          cursor: default;
          color: var(--sui-primary-foreground-color);
          font-weight: var(--sui-font-weight-semi-bold);

          &:hover {
            text-decoration: none;
          }
        }
      }
  }
}
</style>
