<script>
  import { Dialog, Listbox, Option, OptionGroup, SearchBar, TextInput } from '@sveltia/ui';
  import { createEventDispatcher, onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import AssetsPanel from '$lib/components/assets/shared/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import ExternalAssetsPanel from '$lib/components/assets/shared/external-assets-panel.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { allAssetFolders, allAssets } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents';
  import { selectAssetsView } from '$lib/services/contents/editor';
  import {
    allCloudStorageServices,
    allStockPhotoServices,
  } from '$lib/services/integrations/media-libraries';
  import { prefs } from '$lib/services/prefs';
  import { generateUUID } from '$lib/services/utils/crypto';

  export let open = false;
  /**
   * @type {'image' | 'any'}
   */
  export let kind = 'image';
  export let canEnterURL = true;

  const dispatch = createEventDispatcher();
  const title = kind === 'image' ? $_('assets_dialog.title.image') : $_('assets_dialog.title.file');
  let libraryName = 'upload';
  /**
   * @type {DropZone}
   */
  let collectionAssetsDropZone;
  /**
   * @type {DropZone}
   */
  let allAssetsDropZone;
  let elementIdPrefix = '';
  /**
   * @type {SelectedAsset | null}
   */
  let selectedAsset = null;
  let enteredURL = '';
  let searchTerms = '';

  $: ({ internalPath = '', entryRelative = false } =
    $selectedCollection?._assetFolder ?? /** @type {any} */ ({}));
  $: showUploader = libraryName === 'upload';
  $: showCollectionAssets = !!internalPath && !entryRelative;
  $: isLocalLibrary = ['collection-files', 'all-files'].includes(libraryName);
  $: isEnabledMediaService =
    (Object.keys(allStockPhotoServices).includes(libraryName) && $prefs?.apiKeys?.[libraryName]) ||
    (Object.keys(allCloudStorageServices).includes(libraryName) && $prefs?.logins?.[libraryName]);

  $: {
    if (open) {
      // Reset values
      enteredURL = '';
    }
  }

  onMount(() => {
    elementIdPrefix = `library-${generateUUID('short')}`;
  });
</script>

<Dialog
  {title}
  size={'x-large'}
  okLabel={$_('insert')}
  okDisabled={!selectedAsset}
  bind:open
  on:ok={() => {
    dispatch('select', selectedAsset);
  }}
>
  <svelte:fragment slot="header-extra">
    {#if isLocalLibrary || isEnabledMediaService}
      <ViewSwitcher currentView={selectAssetsView} aria-controls="select-assets-grid" />
      <SearchBar
        bind:value={searchTerms}
        disabled={!!selectedAsset?.file}
        aria-label={$_(`assets_dialog.search_for_${kind}`)}
      />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="footer-extra">
    {#if isEnabledMediaService}
      {@const { showServiceLink, serviceLabel, serviceURL } =
        allStockPhotoServices[libraryName] ?? {}}
      {#if showServiceLink}
        <a href={serviceURL}>
          {$_('prefs.media.stock_photos.credit', { values: { service: serviceLabel } })}
        </a>
      {/if}
    {/if}
  </svelte:fragment>
  <div role="none" class="wrapper">
    <Listbox
      class="tabs"
      aria-label={$_('assets_dialog.locations')}
      aria-controls="{elementIdPrefix}-content-pane"
      on:change={(event) => {
        libraryName = /** @type {CustomEvent} */ (event).detail.name;
        selectedAsset = null;
        collectionAssetsDropZone?.reset();
        allAssetsDropZone?.reset();
      }}
    >
      <OptionGroup label={$_('assets_dialog.location.local')}>
        <Option name="upload" label={$_('upload')} selected={showUploader} />
      </OptionGroup>
      <OptionGroup label={$_('assets_dialog.location.repository')}>
        {#if showCollectionAssets}
          <Option
            name="collection-files"
            label={$_('collection_assets')}
            selected={libraryName === 'collection-files'}
          />
        {/if}
        <Option name="all-files" label={$_('all_assets')} selected={libraryName === 'all-files'} />
      </OptionGroup>
      {#if canEnterURL || !!Object.keys(allCloudStorageServices).length}
        <OptionGroup label={$_('assets_dialog.location.external_locations')}>
          {#if canEnterURL}
            <Option name="enter-url" label={$_('assets_dialog.enter_url')} />
          {/if}
          {#each Object.values(allCloudStorageServices) as { serviceId, serviceLabel } (serviceId)}
            <Option name={serviceId} label={serviceLabel} />
          {/each}
        </OptionGroup>
      {/if}
      <OptionGroup label={$_('assets_dialog.location.stock_photos')}>
        {#each Object.values(allStockPhotoServices) as { serviceId, serviceLabel } (serviceId)}
          <Option name={serviceId} label={serviceLabel} />
        {/each}
      </OptionGroup>
    </Listbox>
    <div role="none" id="{elementIdPrefix}-content-pane" class="content-pane">
      {#if showCollectionAssets && (libraryName === 'collection-files' || showUploader)}
        <DropZone
          bind:this={collectionAssetsDropZone}
          accept={kind === 'image' ? 'image/*' : undefined}
          showUploadButton={showUploader}
          showFilePreview={true}
          on:select={({ detail: { files } }) => {
            selectedAsset = files.length ? { file: files[0] } : null;
          }}
        >
          {#if !showUploader}
            <AssetsPanel
              assets={$allAssets.filter(
                (asset) => (!kind || kind === asset.kind) && internalPath === asset.folder,
              )}
              viewType={$selectAssetsView?.type}
              {searchTerms}
              gridId="select-assets-grid"
              checkerboard={true}
              on:select={({ detail }) => {
                selectedAsset = detail;
              }}
            />
          {/if}
        </DropZone>
      {/if}
      {#if libraryName === 'all-files' || (!showCollectionAssets && showUploader)}
        <DropZone
          bind:this={allAssetsDropZone}
          accept={kind === 'image' ? 'image/*' : undefined}
          showUploadButton={showUploader}
          showFilePreview={true}
          on:select={({ detail: { files } }) => {
            selectedAsset = files.length ? { file: files[0] } : null;
          }}
        >
          {#if !showUploader}
            <AssetsPanel
              assets={$allAssets.filter(
                (asset) =>
                  (!kind || kind === asset.kind) &&
                  // Hide assets stored in an entry-relative path, since these files are only used
                  // for the associated entry
                  !$allAssetFolders.find((folder) => folder.collectionName === asset.collectionName)
                    ?.entryRelative,
              )}
              viewType={$selectAssetsView?.type}
              {searchTerms}
              gridId="select-assets-grid"
              checkerboard={true}
              on:select={({ detail }) => {
                selectedAsset = detail;
              }}
            />
          {/if}
        </DropZone>
      {/if}
      {#if canEnterURL && libraryName === 'enter-url'}
        <EmptyState>
          <div role="none">
            {kind === 'image'
              ? $_('assets_dialog.enter_image_url')
              : $_('assets_dialog.enter_file_url')}
          </div>
          <TextInput
            bind:value={enteredURL}
            flex
            on:input={() => {
              selectedAsset = enteredURL.trim() ? { url: enteredURL.trim() } : null;
            }}
          />
        </EmptyState>
      {/if}
      {#each Object.entries(allCloudStorageServices) as [serviceId, serviceProps] (serviceId)}
        {#if libraryName === serviceId}
          <ExternalAssetsPanel
            {kind}
            {searchTerms}
            {serviceProps}
            gridId="select-assets-grid"
            on:select={({ detail }) => {
              selectedAsset = detail;
            }}
          />
        {/if}
      {/each}
      {#each Object.entries(allStockPhotoServices) as [serviceId, serviceProps] (serviceId)}
        {#if libraryName === serviceId}
          <ExternalAssetsPanel
            {kind}
            {searchTerms}
            {serviceProps}
            gridId="select-assets-grid"
            on:select={({ detail }) => {
              selectedAsset = detail;
            }}
          />
        {/if}
      {/each}
    </div>
  </div>
</Dialog>

<style lang="scss">
  .wrapper {
    display: flex;
    gap: 16px;
    height: 60vh;

    :global(.listbox) {
      flex: none;
      background-color: transparent;
    }

    .content-pane {
      overflow: auto;
      flex: auto;
    }
  }
</style>
