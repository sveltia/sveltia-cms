<script>
  import { _ } from '@sveltia/i18n';
  import { onMount, untrack } from 'svelte';

  import ExternalDetailsOverlay from '$lib/components/assets/list/external/details-overlay.svelte';
  import ExternalMainArea from '$lib/components/assets/list/external/main-area.svelte';
  import AssetList from '$lib/components/assets/list/internal/asset-list.svelte';
  import DeleteFolderDialog from '$lib/components/assets/list/internal/delete-folder-dialog.svelte';
  import AssetDetailsOverlay from '$lib/components/assets/list/internal/details-overlay.svelte';
  import EditAssetDialog from '$lib/components/assets/list/internal/edit-asset-dialog.svelte';
  import FolderInfoPanel from '$lib/components/assets/list/internal/folder-info-panel.svelte';
  import InfoPanel from '$lib/components/assets/list/internal/info-panel.svelte';
  import NewFolderDialog from '$lib/components/assets/list/internal/new-folder-dialog.svelte';
  import PrimaryToolbar from '$lib/components/assets/list/internal/primary-toolbar.svelte';
  import RenameAssetDialog from '$lib/components/assets/list/internal/rename-dialog.svelte';
  import RenameFolderDialog from '$lib/components/assets/list/internal/rename-folder-dialog.svelte';
  import PrimarySidebar from '$lib/components/assets/list/primary-sidebar.svelte';
  import SecondarySidebar from '$lib/components/assets/list/secondary-sidebar.svelte';
  import SecondaryToolbar from '$lib/components/assets/list/secondary-toolbar.svelte';
  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import NotFound from '$lib/components/global/not-found.svelte';
  import SearchMainArea from '$lib/components/search/search-main-area.svelte';
  import { updateContentFromHashChange } from '$lib/services/app/navigation';
  import { hasAuthInfo, selectedCloudService } from '$lib/services/assets/external';
  import { loadExternalAssets } from '$lib/services/assets/external/data';
  import { LINKED_FILES_SERVICE_ID, linkedAssets } from '$lib/services/assets/external/linked';
  import {
    ASSETS_ROUTE_REGEX,
    discardAssetsNavigation,
    getSelectedAssetFolderLabel,
    resolveAssetsRoute,
  } from '$lib/services/assets/navigation';
  import { focusedAsset, selectedAssets } from '$lib/services/assets/state';
  import { assetGroups, listedAssets, showAssetOverlay } from '$lib/services/assets/view';
  import { sortKeys } from '$lib/services/assets/view/sort-keys';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  let isIndexPage = $state(false);
  let isSearchPage = $state(false);
  let notFound = $state(false);

  const selectedAssetFolderLabel = $derived(getSelectedAssetFolderLabel());

  /**
   * Navigate to the asset list or asset details page given the URL hash.
   */
  const navigate = () => {
    ({ isIndexPage, isSearchPage, notFound } = resolveAssetsRoute());
  };

  // Fetch the assets on the selected cloud storage service once the user has provided the
  // credentials. This lives on the page rather than in the main area, because the main area isn’t
  // rendered while the details overlay is shown, and a direct link to an asset’s details needs the
  // list as well. The Cloudinary widget handles authentication and listing on its own
  $effect(() => {
    const service = selectedCloudService.current;

    if (service && service.authType !== 'widget' && hasAuthInfo(service)) {
      // The linked files come from the entries, so reload the list whenever these change
      if (service.serviceId === LINKED_FILES_SERVICE_ID) {
        void linkedAssets.current;
      }

      untrack(() => {
        loadExternalAssets(service);
      });
    }
  });

  onMount(() => {
    navigate();

    return () => {
      // Discard a navigation still in flight
      discardAssetsNavigation();
      showAssetOverlay.current = false;
    };
  });
</script>

<svelte:window
  onhashchange={(event) => {
    updateContentFromHashChange(event, navigate, ASSETS_ROUTE_REGEX);
  }}
/>

<PageContainer uiSettingsKey="assets-page" aria-label={_('asset_library')}>
  {#snippet primarySidebar()}
    {#if !env.isSmallScreen || isIndexPage}
      <PrimarySidebar {isSearchPage} />
    {/if}
  {/snippet}
  {#snippet main()}
    {#if isSearchPage}
      <SearchMainArea />
    {:else if notFound}
      <PageContainerMainArea aria-label={_('asset_library')}>
        {#snippet mainContent()}
          <NotFound message={_('asset_folder_not_found')} backPath="/assets" />
        {/snippet}
      </PageContainerMainArea>
    {:else if selectedCloudService.current}
      <ExternalMainArea />
    {:else if !env.isSmallScreen || !isIndexPage}
      <PageContainerMainArea
        id="assets-container"
        aria-label={_('x_asset_folder', { values: { folder: selectedAssetFolderLabel } })}
      >
        {#snippet primaryToolbar()}
          <PrimaryToolbar />
        {/snippet}
        {#snippet secondaryToolbar()}
          {#if listedAssets.current.length}
            <SecondaryToolbar
              allItems={Object.values(assetGroups.current).flat(1)}
              selectedItems={selectedAssets}
              totalCount={listedAssets.current.length}
              sortKeys={sortKeys.current}
            />
          {/if}
        {/snippet}
        {#snippet mainContent()}
          <AssetList />
        {/snippet}
        {#snippet secondarySidebar()}
          <SecondarySidebar asset={focusedAsset.current}>
            {#snippet children(/** @type {Asset} */ asset)}
              <InfoPanel {asset} showPreview={true} />
            {/snippet}
            {#snippet fallback()}
              <FolderInfoPanel />
            {/snippet}
          </SecondarySidebar>
        {/snippet}
      </PageContainerMainArea>
    {/if}
  {/snippet}
</PageContainer>

{#if showAssetOverlay.current}
  {#if selectedCloudService.current}
    <ExternalDetailsOverlay />
  {:else}
    <AssetDetailsOverlay />
  {/if}
{/if}

<EditAssetDialog />
<RenameAssetDialog />
<NewFolderDialog />
<RenameFolderDialog />
<DeleteFolderDialog />
