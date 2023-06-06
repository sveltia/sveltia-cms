<script>
  import { Button, Dialog, SearchBar, Tab, TabList, TabPanel, TextInput } from '@sveltia/ui';
  import { createEventDispatcher, onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import AssetsPanel from '$lib/components/assets/shared/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import StockPhotoPanel from '$lib/components/assets/shared/stock-photo-panel.svelte';
  import { allAssets } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents';
  import { allMediaServices } from '$lib/services/integrations/media';
  import { prefs } from '$lib/services/prefs';
  import { generateUUID, stripSlashes } from '$lib/services/utils/strings';

  export let open = false;
  /**
   * @type {string}
   */
  export let kind = undefined;
  export let canEnterURL = true;

  const dispatch = createEventDispatcher();
  const title = kind === 'image' ? $_('select_image') : $_('select_file');
  /**
   * @type {import('svelte').SvelteComponentTyped}
   */
  let collectionAssetsDropZone = undefined;
  /**
   * @type {import('svelte').SvelteComponentTyped}
   */
  let allAssetsDropZone = undefined;
  let tabPanelIdPrefix = '';
  /**
   * @type {?SelectedAsset}
   */
  let selectedAsset = null;
  let enteredURL = '';
  let searchTerms = '';

  $: collectionMediaFolder = stripSlashes($selectedCollection.media_folder || '');
  $: libraryName = collectionMediaFolder ? 'collection-files' : 'all-files';
  $: isLocalLibrary = ['collection-files', 'all-files'].includes(libraryName);
  $: isEnabledMediaService =
    Object.keys(allMediaServices).includes(libraryName) && $prefs?.apiKeys?.[libraryName];

  $: {
    if (open) {
      // Reset values
      enteredURL = '';
    }
  }

  onMount(() => {
    tabPanelIdPrefix = `tabs-${generateUUID().split('-').pop()}-panel`;
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
    {#if isLocalLibrary}
      <Button
        class="secondary"
        label={$_('upload')}
        on:click={() => {
          if (libraryName === 'collection-files') {
            collectionAssetsDropZone.openFilePicker();
          } else {
            allAssetsDropZone.openFilePicker();
          }
        }}
      />
    {/if}
    {#if isLocalLibrary || isEnabledMediaService}
      <SearchBar bind:value={searchTerms} disabled={!!selectedAsset?.file} />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="footer-extra">
    {#if isEnabledMediaService}
      {@const { showServiceLink, serviceLabel, landingURL } = allMediaServices[libraryName]}
      {#if showServiceLink}
        <a href={landingURL}>
          {$_('prefs.media.stock_photo.credit', { values: { service: serviceLabel } })}
        </a>
      {/if}
    {/if}
  </svelte:fragment>
  <div class="wrapper">
    <TabList
      orientation="vertical"
      on:select={(/** @type {CustomEvent} */ event) => {
        libraryName = event.detail.name;
        selectedAsset = null;
      }}
    >
      {#if collectionMediaFolder}
        <Tab
          name="collection-files"
          label={$_('collection_files')}
          aria-selected={libraryName === 'collection-files'}
          aria-controls="{tabPanelIdPrefix}-collection-assets"
        />
      {/if}
      <Tab
        name="all-files"
        label={$_('all_files')}
        aria-selected={libraryName === 'all-files'}
        aria-controls="{tabPanelIdPrefix}-all-assets"
      />
      {#if canEnterURL}
        <Tab name="enter_url" label={$_('enter_url')} aria-controls="{tabPanelIdPrefix}-url" />
      {/if}
      {#each Object.values(allMediaServices) as { serviceId, serviceLabel } (serviceId)}
        <Tab name={serviceId} label={serviceLabel} aria-controls="{tabPanelIdPrefix}-{serviceId}" />
      {/each}
    </TabList>
    {#if collectionMediaFolder}
      <TabPanel id="{tabPanelIdPrefix}-collection-assets">
        <DropZone
          bind:this={collectionAssetsDropZone}
          accept={kind === 'image' ? 'image/*' : undefined}
          showFilePreview={true}
          on:select={({ detail: { files } }) => {
            selectedAsset = files.length ? { file: files[0] } : null;
          }}
        >
          <AssetsPanel
            assets={$allAssets.filter(
              (asset) => (!kind || kind === asset.kind) && collectionMediaFolder === asset.folder,
            )}
            {searchTerms}
            on:select={({ detail }) => {
              selectedAsset = detail;
            }}
          />
        </DropZone>
      </TabPanel>
    {/if}
    <TabPanel id="{tabPanelIdPrefix}-all-assets">
      <DropZone
        bind:this={allAssetsDropZone}
        accept={kind === 'image' ? 'image/*' : undefined}
        showFilePreview={true}
        on:select={({ detail: { files } }) => {
          selectedAsset = files.length ? { file: files[0] } : null;
        }}
      >
        <AssetsPanel
          assets={$allAssets.filter((asset) => !kind || kind === asset.kind)}
          {searchTerms}
          on:select={({ detail }) => {
            selectedAsset = detail;
          }}
        />
      </DropZone>
    </TabPanel>
    {#if canEnterURL}
      <TabPanel id="{tabPanelIdPrefix}-url">
        <div class="panel-content">
          <div>{$_('enter_image_url')}</div>
          <TextInput
            bind:value={enteredURL}
            on:input={() => {
              selectedAsset = enteredURL.trim() ? { url: enteredURL.trim() } : null;
            }}
          />
        </div>
      </TabPanel>
    {/if}
    {#each Object.entries(allMediaServices) as [serviceId, props] (serviceId)}
      <TabPanel id="{tabPanelIdPrefix}-{serviceId}">
        {#if libraryName === serviceId}
          <StockPhotoPanel
            {...props}
            {searchTerms}
            on:select={({ detail }) => {
              selectedAsset = detail;
            }}
          />
        {/if}
      </TabPanel>
    {/each}
  </div>
</Dialog>

<style lang="scss">
  .wrapper {
    display: flex;
    height: 60vh;

    :global(.tab-list) {
      flex: none;
    }

    :global(.tabpanel) {
      overflow: auto;
      flex: auto;
    }
  }

  .panel-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100%;
  }
</style>
