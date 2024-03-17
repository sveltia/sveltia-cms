<script>
  import { Alert, Group, Toast } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import AssetDetailsOverlay from '$lib/components/assets/details/asset-details-overlay.svelte';
  import AssetList from '$lib/components/assets/list/asset-list.svelte';
  import PrimarySidebar from '$lib/components/assets/list/primary-sidebar.svelte';
  import PrimaryToolbar from '$lib/components/assets/list/primary-toolbar.svelte';
  import SecondarySidebar from '$lib/components/assets/list/secondary-sidebar.svelte';
  import SecondaryToolbar from '$lib/components/assets/list/secondary-toolbar.svelte';
  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import {
    allAssetFolders,
    allAssets,
    overlaidAsset,
    selectedAssetFolder,
  } from '$lib/services/assets';
  import { assetUpdatesToast } from '$lib/services/assets/data';
  import { getFolderLabelByPath, listedAssets } from '$lib/services/assets/view';
  import { announcedPageStatus, parseLocation } from '$lib/services/navigation';

  let path = '';

  $: selectedAssetFolderLabel = getFolderLabelByPath($selectedAssetFolder?.internalPath);

  /**
   * Navigate to the asset list or asset details page given the URL hash.
   * @todo Show Not Found page.
   */
  const navigate = () => {
    ({ path } = parseLocation());

    const [match, folderPath, fileName] =
      path.match(/^\/assets(?:\/([/\-\w]+))?(?:\/([^/]+.\w{2,4}))?$/) ?? [];

    if (!match) {
      return;
    }

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

      $overlaidAsset = undefined;
      $announcedPageStatus = $_(
        // eslint-disable-next-line no-nested-ternary
        count > 1
          ? 'viewing_x_asset_folder_many_assets'
          : count === 1
            ? 'viewing_x_asset_folder_one_asset'
            : 'viewing_x_asset_folder_no_asset',
        { values: { folder: selectedAssetFolderLabel, count } },
      );

      return;
    }

    $overlaidAsset = path.match(/^\/assets\/(.+?)\.[a-zA-Z0-9]+$/)
      ? $allAssets.find((asset) => asset.path === `${folderPath}/${fileName}`)
      : undefined;
    $announcedPageStatus = $overlaidAsset
      ? $_('viewing_x_asset_details', { values: { name: $overlaidAsset.name } })
      : $_('file_not_found');
  };

  onMount(() => {
    navigate();
  });
</script>

<svelte:window
  on:hashchange={() => {
    navigate();
  }}
/>

<PageContainer class="media" aria-label={$_('asset_library')}>
  <PrimarySidebar slot="primary_sidebar" />
  <Group
    slot="main"
    id="assets-container"
    class="main"
    aria-label={$_('x_asset_folder', {
      values: { folder: selectedAssetFolderLabel },
    })}
  >
    <PageContainerMainArea>
      <PrimaryToolbar slot="primary_toolbar" />
      <SecondaryToolbar slot="secondary_toolbar" />
      <AssetList slot="main_content" />
      <SecondarySidebar slot="secondary_sidebar" />
    </PageContainerMainArea>
  </Group>
</PageContainer>

{#if $overlaidAsset}
  <AssetDetailsOverlay />
{/if}

<Toast bind:show={$assetUpdatesToast.saved}>
  <Alert status="success">
    {$_(
      // eslint-disable-next-line no-nested-ternary
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

<Toast bind:show={$assetUpdatesToast.deleted}>
  <Alert status="success">
    {$_($assetUpdatesToast.count === 1 ? 'asset_deleted' : 'assets_deleted', {
      values: { count: $assetUpdatesToast.count },
    })}
  </Alert>
</Toast>
