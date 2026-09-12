<!--
  @component
  Main area of the Asset Library for a cloud storage service selected under External Locations. It
  mirrors the layout used for repository folders — toolbars, list and Info pane — but works on the
  assets fetched from the service’s API rather than the ones in the repository.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import AssetList from '$lib/components/assets/list/external/asset-list.svelte';
  import InfoPanel from '$lib/components/assets/list/external/info-panel.svelte';
  import PrimaryToolbar from '$lib/components/assets/list/external/primary-toolbar.svelte';
  import RenameDialog from '$lib/components/assets/list/external/rename-dialog.svelte';
  import SecondarySidebar from '$lib/components/assets/list/secondary-sidebar.svelte';
  import SecondaryToolbar from '$lib/components/assets/list/secondary-toolbar.svelte';
  import RejectedFilesAlertDialog from '$lib/components/assets/shared/rejected-files-alert-dialog.svelte';
  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import {
    externalAssets,
    externalAssetSearchTerms,
    focusedExternalAsset,
    hasAuthInfo,
    selectedCloudService,
    selectedExternalAssets,
  } from '$lib/services/assets/external';
  import {
    externalAssetsToast,
    getSharedMediaLibraryOptions,
    loadExternalAssets,
    uploadExternalAssets,
    uploadingExternalAssets,
  } from '$lib/services/assets/external/data';
  import { externalAssetSortKeys, listedExternalAssets } from '$lib/services/assets/external/view';

  /**
   * @import { ExternalAsset, MediaLibraryService } from '$lib/types/private';
   */

  /** The component is only rendered while a service is selected. */
  const service = $derived(/** @type {MediaLibraryService} */ (selectedCloudService.current));
  const maxSize = $derived(getSharedMediaLibraryOptions().max_file_size ?? Infinity);

  /** @type {string[]} */
  let oversizedFileNames = $state([]);
  /** @type {string[]} */
  let invalidFileNames = $state([]);
  let showRejectedFilesAlert = $state(false);

  // Fetch the assets once the service is selected and the user has provided the credentials. The
  // Cloudinary widget handles authentication and listing on its own
  $effect(() => {
    if (service.authType !== 'widget' && hasAuthInfo(service)) {
      untrack(() => {
        loadExternalAssets(service);
      });
    }
  });

  // Upload the files dropped on the list, picked with the Upload button or chosen to replace an
  // existing asset
  $effect(() => {
    const { files, originalAsset } = uploadingExternalAssets.current;

    if (!files.length) {
      return;
    }

    untrack(async () => {
      uploadingExternalAssets.current = { files: [] };

      const rejected = await uploadExternalAssets(files, { originalAsset });

      oversizedFileNames = rejected.oversizedFileNames;
      invalidFileNames = rejected.invalidFileNames;

      if (oversizedFileNames.length || invalidFileNames.length) {
        showRejectedFilesAlert = true;
      }
    });
  });
</script>

<PageContainerMainArea
  id="assets-container"
  aria-label={_('x_asset_folder', { values: { folder: service.serviceLabel } })}
>
  {#snippet primaryToolbar()}
    <PrimaryToolbar />
  {/snippet}
  {#snippet secondaryToolbar()}
    {#if externalAssets.current?.length}
      <!-- The menus stay enabled while a filter or search narrows the list, so it can be reset -->
      <SecondaryToolbar
        allItems={listedExternalAssets.current}
        selectedItems={selectedExternalAssets}
        totalCount={externalAssets.current.length}
        sortKeys={externalAssetSortKeys.current}
        searchTerms={externalAssetSearchTerms}
      />
    {/if}
  {/snippet}
  {#snippet mainContent()}
    <AssetList />
  {/snippet}
  {#snippet secondarySidebar()}
    <SecondarySidebar asset={focusedExternalAsset.current}>
      {#snippet children(/** @type {ExternalAsset} */ asset)}
        <InfoPanel {asset} />
      {/snippet}
    </SecondarySidebar>
  {/snippet}
</PageContainerMainArea>

<RenameDialog />

<Toast bind:show={externalAssetsToast.current.show}>
  <Alert status={externalAssetsToast.current.status}>
    {#if externalAssetsToast.current.message}
      {_(externalAssetsToast.current.message)}
    {/if}
  </Alert>
</Toast>

<RejectedFilesAlertDialog
  bind:open={showRejectedFilesAlert}
  {oversizedFileNames}
  {invalidFileNames}
  {maxSize}
/>
