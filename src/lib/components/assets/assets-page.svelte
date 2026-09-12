<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { sleep } from '@sveltia/utils/misc';
  import equal from 'fast-deep-equal';
  import { onMount, untrack } from 'svelte';

  import ExternalDetailsOverlay from '$lib/components/assets/list/external/details-overlay.svelte';
  import ExternalMainArea from '$lib/components/assets/list/external/main-area.svelte';
  import AssetList from '$lib/components/assets/list/internal/asset-list.svelte';
  import AssetDetailsOverlay from '$lib/components/assets/list/internal/details-overlay.svelte';
  import EditAssetDialog from '$lib/components/assets/list/internal/edit-asset-dialog.svelte';
  import InfoPanel from '$lib/components/assets/list/internal/info-panel.svelte';
  import PrimaryToolbar from '$lib/components/assets/list/internal/primary-toolbar.svelte';
  import RenameAssetDialog from '$lib/components/assets/list/internal/rename-dialog.svelte';
  import PrimarySidebar from '$lib/components/assets/list/primary-sidebar.svelte';
  import SecondarySidebar from '$lib/components/assets/list/secondary-sidebar.svelte';
  import SecondaryToolbar from '$lib/components/assets/list/secondary-toolbar.svelte';
  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import NotFound from '$lib/components/global/not-found.svelte';
  import SearchMainArea from '$lib/components/search/search-main-area.svelte';
  import {
    announcedPageStatus,
    goto,
    parseLocation,
    updateContentFromHashChange,
  } from '$lib/services/app/navigation';
  import { allAssets, focusedAsset, overlaidAsset, selectedAssets } from '$lib/services/assets';
  import {
    enabledCloudServices,
    EXTERNAL_LOCATION_PATH_PREFIX,
    getCloudService,
    getCloudServicePath,
    hasAuthInfo,
    overlaidExternalAssetId,
    resetExternalAssets,
    selectedCloudService,
  } from '$lib/services/assets/external';
  import { loadExternalAssets } from '$lib/services/assets/external/data';
  import {
    LINKED_FILES_SERVICE_ID,
    linkedAssets,
    linkedFilesService,
  } from '$lib/services/assets/external/linked';
  import { allAssetFolders, selectedAssetFolder } from '$lib/services/assets/folders';
  import {
    assetGroups,
    getFolderLabelByCollection,
    listedAssets,
    showAssetOverlay,
  } from '$lib/services/assets/view';
  import { sortKeys } from '$lib/services/assets/view/sort-keys';
  import { isSearchRoute } from '$lib/services/search/navigation';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Asset } from '$lib/types/private';
   */

  const ROUTE_REGEX = /^\/assets(?:\/(?<folderPath>.+?)(?:\/(?<fileName>[^/]+\.[A-Za-z0-9]+))?)?$/;

  let isIndexPage = $state(false);
  let isSearchPage = $state(false);
  let notFound = $state(false);

  const selectedAssetFolderLabel = $derived.by(() => {
    if (selectedCloudService.current) {
      return selectedCloudService.current.serviceLabel;
    }

    // `appLocale.current` is a key, because `getFolderLabelByCollection` can return a localized
    // label
    return appLocale.current && selectedAssetFolder.current
      ? getFolderLabelByCollection(selectedAssetFolder.current)
      : '';
  });

  /**
   * Select a cloud storage service listed under External Locations, whose assets are shown in
   * place of a repository folder, and optionally show the details of an asset on the service.
   * @param {string} serviceId Service ID.
   * @param {string} [assetId] ID of the asset to be shown in the details overlay.
   */
  const selectCloudService = (serviceId, assetId = '') => {
    const service = getCloudService(serviceId);

    selectedAssetFolder.current = undefined;

    if (!service) {
      selectedCloudService.current = undefined;
      showAssetOverlay.current = false;
      announcedPageStatus.current = _('asset_folder_not_found');
      notFound = true;

      return;
    }

    if (selectedCloudService.current !== service) {
      resetExternalAssets();
      selectedCloudService.current = service;
    }

    if (assetId) {
      overlaidExternalAssetId.current = assetId;
      showAssetOverlay.current = true;
      announcedPageStatus.current = _('viewing_x_asset_details', {
        values: { name: assetId.split('/').pop() },
      });
    } else {
      overlaidExternalAssetId.current = undefined;
      showAssetOverlay.current = false;
      announcedPageStatus.current = _('viewing_x_external_location', {
        values: { service: service.serviceLabel },
      });
    }
  };

  /**
   * Navigate to the asset list or asset details page given the URL hash.
   */
  const navigate = async () => {
    const { path } = parseLocation();
    const match = path.match(ROUTE_REGEX);

    isIndexPage = false;
    isSearchPage = false;
    notFound = false;

    if (!match?.groups) {
      showAssetOverlay.current = false;
      // Check if it’s the search page, which has a different URL pattern (`#/search/{query}`)
      isSearchPage = isSearchRoute(path);

      return; // Different page
    }

    const { folderPath, fileName } = match.groups;

    if (
      folderPath?.startsWith(EXTERNAL_LOCATION_PATH_PREFIX) &&
      folderPath !== `${EXTERNAL_LOCATION_PATH_PREFIX}all`
    ) {
      // The path is `-/{serviceId}` for the asset list, or `-/{serviceId}/{assetId}` for the asset
      // details. An asset ID can contain slashes, and it doesn’t have to end with a file extension,
      // so the ID is everything after the service ID, whether the regex has split it or not
      const [serviceId, ...rest] = folderPath
        .slice(EXTERNAL_LOCATION_PATH_PREFIX.length)
        .split('/');

      // Only drop a missing file name: an empty segment is significant, as in `https://`
      selectCloudService(serviceId, [...rest, ...(fileName ? [fileName] : [])].join('/'));

      return;
    }

    selectedCloudService.current = undefined;

    if (!folderPath) {
      if (env.isSmallScreen) {
        // Show the asset folder list only
        selectedAssetFolder.current = undefined;
        showAssetOverlay.current = false;
        announcedPageStatus.current = _('viewing_asset_folder_list');
        isIndexPage = true;
      } else if (allAssetFolders.current.length) {
        // Redirect to All Assets
        goto('/assets/-/all');
      } else {
        // No asset folder is configured, so redirect to the first external location, or to the
        // files linked from entries if there is none either
        goto(getCloudServicePath(enabledCloudServices.current[0] ?? linkedFilesService));
      }

      return;
    }

    const folder =
      window.history.state?.folder ??
      allAssetFolders.current.find(({ internalPath, collectionName }) =>
        folderPath === '-/all'
          ? internalPath === undefined && collectionName === undefined
          : internalPath === folderPath,
      );

    if (!folder && !fileName) {
      selectedAssetFolder.current = undefined;
      showAssetOverlay.current = false;
      announcedPageStatus.current = _('asset_folder_not_found');
      notFound = true;

      return; // Not Found
    }

    if (!folder) {
      // A folder path that comes with a file name doesn’t have to be a configured asset folder,
      // because an asset can live in a subfolder of one. The asset itself is looked up by its full
      // path below, so leave the resolution to that
      selectedAssetFolder.current = undefined;
    } else if (!equal(selectedAssetFolder.current, folder)) {
      selectedAssetFolder.current = folder;
    }

    if (!fileName) {
      // Wait for `selectedAssetFolderLabel` to be updated
      await sleep(100);

      showAssetOverlay.current = false;
      announcedPageStatus.current = _('viewing_x_asset_folder', {
        values: {
          folder: selectedAssetFolderLabel,
          count: listedAssets.current.length,
        },
      });

      return;
    }

    overlaidAsset.current = fileName
      ? allAssets.current.find((asset) => asset.path === `${folderPath}/${fileName}`)
      : undefined;
    announcedPageStatus.current = overlaidAsset.current
      ? _('viewing_x_asset_details', { values: { name: overlaidAsset.current.name } })
      : _('file_not_found');
    showAssetOverlay.current = true;
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
      showAssetOverlay.current = false;
    };
  });
</script>

<svelte:window
  onhashchange={(event) => {
    updateContentFromHashChange(event, navigate, ROUTE_REGEX);
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
