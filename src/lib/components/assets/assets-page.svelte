<script>
  import { Toast } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import AssetDetailsOverlay from '$lib/components/assets/details/asset-details-overlay.svelte';
  import AssetList from '$lib/components/assets/list/asset-list.svelte';
  import PrimarySidebar from '$lib/components/assets/list/primary-sidebar.svelte';
  import PrimaryToolbar from '$lib/components/assets/list/primary-toolbar.svelte';
  import SecondarySidebar from '$lib/components/assets/list/secondary-sidebar.svelte';
  import SecondaryToolbar from '$lib/components/assets/list/secondary-toolbar.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import {
    allAssetPaths,
    allAssets,
    selectedAsset,
    selectedAssetFolderPath,
  } from '$lib/services/assets';
  import { assetUpdatesToast } from '$lib/services/assets/data';
  import { parseLocation } from '$lib/services/navigation';

  let path = '';

  /**
   * Navigate to the asset list or asset details page given the URL hash.
   * @todo Show Not Found page.
   */
  const navigate = () => {
    ({ path } = parseLocation());

    const [match, folderPath, fileName] =
      path.match(/^\/assets(?:\/([/\-\w]+))?(?:\/([^/]+.\w{3,4}))?$/) ?? [];

    if (!match) {
      return;
    }

    if (!folderPath) {
      $selectedAssetFolderPath = '';
    } else if (
      $allAssetPaths.some(({ internalPath }) => folderPath === internalPath) &&
      $selectedAssetFolderPath !== folderPath
    ) {
      $selectedAssetFolderPath = folderPath;
    }

    $selectedAsset = fileName
      ? $allAssets.find((asset) => asset.path === `${folderPath}/${fileName}`) ?? null
      : null;
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

<PageContainer class="media">
  <PrimarySidebar slot="primary_sidebar" />
  <PrimaryToolbar slot="primary_toolbar" />
  <SecondaryToolbar slot="secondary_toolbar" />
  <AssetList slot="main" />
  <SecondarySidebar slot="secondary_sidebar" />
</PageContainer>

{#if $selectedAsset && path.match(/^\/assets\/(.+?)\.[a-zA-Z0-9]+$/)}
  <AssetDetailsOverlay />
{/if}

<Toast bind:show={$assetUpdatesToast.saved} type="success">
  {$_('asset_saved')}
</Toast>

<Toast bind:show={$assetUpdatesToast.deleted} type="success">
  {$_($assetUpdatesToast.count === 1 ? 'asset_deleted' : 'assets_deleted', {
    values: { count: $assetUpdatesToast.count },
  })}
</Toast>
