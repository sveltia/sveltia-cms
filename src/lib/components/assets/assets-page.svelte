<script>
  import { Alert, Group, Toast } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
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
  import { announcedPageStatus, parseLocation } from '$lib/services/app/navigation';
  import {
    allAssetFolders,
    allAssets,
    overlaidAsset,
    selectedAssetFolder,
    showAssetOverlay,
  } from '$lib/services/assets';
  import { assetUpdatesToast } from '$lib/services/assets/data';
  import { getFolderLabelByPath, listedAssets } from '$lib/services/assets/view';

  const routeRegex =
    /^\/assets(?:\/(?<folderPath>[/\-\w]+))?(?:\/(?<fileName>[^/]+\.[A-Za-z0-9]+))?$/;

  const selectedAssetFolderLabel = $derived(
    getFolderLabelByPath($selectedAssetFolder?.internalPath),
  );

  /**
   * Navigate to the asset list or asset details page given the URL hash.
   * @todo Show Not Found page.
   */
  const navigate = async () => {
    const { path } = parseLocation();
    const match = path.match(routeRegex);

    if (!match?.groups) {
      return;
    }

    const { folderPath, fileName } = match.groups;

    if (!folderPath) {
      $selectedAssetFolder = undefined;
    } else if ($selectedAssetFolder?.internalPath !== folderPath) {
      const folder = $allAssetFolders.find(({ internalPath }) => folderPath === internalPath);

      if (folder) {
        $selectedAssetFolder = folder;
      } else {
        // Not Found
      }
    }

    if (!fileName) {
      const count = $listedAssets.length;

      // Wait for `selectedAssetFolderLabel` to be updated
      await sleep(100);

      $announcedPageStatus = $_(
        count > 1
          ? 'viewing_x_asset_folder_many_assets'
          : count === 1
            ? 'viewing_x_asset_folder_one_asset'
            : 'viewing_x_asset_folder_no_assets',
        { values: { folder: selectedAssetFolderLabel, count } },
      );

      return;
    }

    $overlaidAsset = fileName
      ? $allAssets.find((asset) => asset.path === `${folderPath}/${fileName}`)
      : undefined;
    $announcedPageStatus = $overlaidAsset
      ? $_('viewing_x_asset_details', { values: { name: $overlaidAsset.name } })
      : $_('file_not_found');
    $showAssetOverlay = true;
  };

  onMount(() => {
    navigate();
  });
</script>

<svelte:window
  onhashchange={() => {
    navigate();
  }}
/>

<PageContainer class="media" aria-label={$_('asset_library')}>
  {#snippet primarySidebar()}
    <PrimarySidebar />
  {/snippet}
  {#snippet main()}
    <Group
      id="assets-container"
      class="main"
      aria-label={$_('x_asset_folder', {
        values: { folder: selectedAssetFolderLabel },
      })}
    >
      <PageContainerMainArea>
        {#snippet primaryToolbar()}
          <PrimaryToolbar />
        {/snippet}
        {#snippet secondaryToolbar()}
          <SecondaryToolbar />
        {/snippet}
        {#snippet mainContent()}
          <AssetList />
        {/snippet}
        {#snippet secondarySidebar()}
          <SecondarySidebar />
        {/snippet}
      </PageContainerMainArea>
    </Group>
  {/snippet}
</PageContainer>

<AssetDetailsOverlay />
<EditAssetDialog />
<RenameAssetDialog />

<Toast bind:show={$assetUpdatesToast.saved}>
  <Alert status="success">
    {$_(
      $assetUpdatesToast.published
        ? $assetUpdatesToast.count === 1
          ? 'asset_saved_and_published'
          : 'assets_saved_and_published'
        : $assetUpdatesToast.count === 1
          ? 'asset_saved'
          : 'assets_saved',
      {
        values: { count: $assetUpdatesToast.count },
      },
    )}
  </Alert>
</Toast>

<Toast bind:show={$assetUpdatesToast.moved}>
  <Alert status="success">
    {$_($assetUpdatesToast.count === 1 ? 'asset_moved' : 'assets_moved', {
      values: { count: $assetUpdatesToast.count },
    })}
  </Alert>
</Toast>

<Toast bind:show={$assetUpdatesToast.renamed}>
  <Alert status="success">
    {$_($assetUpdatesToast.count === 1 ? 'asset_renamed' : 'assets_renamed', {
      values: { count: $assetUpdatesToast.count },
    })}
  </Alert>
</Toast>

<Toast bind:show={$assetUpdatesToast.deleted}>
  <Alert status="success">
    {$_($assetUpdatesToast.count === 1 ? 'asset_deleted' : 'assets_deleted', {
      values: { count: $assetUpdatesToast.count },
    })}
  </Alert>
</Toast>
