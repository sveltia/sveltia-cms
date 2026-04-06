<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import equal from 'fast-deep-equal';
  import { onMount } from 'svelte';

  import AssetDetailsOverlay from '$lib/components/assets/details/asset-details-overlay.svelte';
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
  import { allAssets, overlaidAsset } from '$lib/services/assets';
  import { assetUpdatesToast } from '$lib/services/assets/data';
  import { allAssetFolders, selectedAssetFolder } from '$lib/services/assets/folders';
  import {
    getFolderLabelByCollection,
    listedAssets,
    showAssetOverlay,
  } from '$lib/services/assets/view';
  import { isSearchRoute } from '$lib/services/search/navigation';
  import { isSmallScreen } from '$lib/services/user/env';

  const ROUTE_REGEX = /^\/assets(?:\/(?<folderPath>.+?)(?:\/(?<fileName>[^/]+\.[A-Za-z0-9]+))?)?$/;

  let isIndexPage = $state(false);
  let isSearchPage = $state(false);

  const selectedAssetFolderLabel = $derived(
    // `appLocale.current` is a key, because `getFolderLabelByCollection` can return a localized
    // label
    appLocale.current && $selectedAssetFolder
      ? getFolderLabelByCollection($selectedAssetFolder)
      : '',
  );

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
      // Check if it's the search page, which has a different URL pattern (`#/search/{query}`)
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
      <PrimarySidebar {isSearchPage} />
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
          {#if $listedAssets.length}
            <SecondaryToolbar />
          {/if}
        {/snippet}
        {#snippet mainContent()}
          <AssetList />
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
