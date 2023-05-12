<script>
  import { Dialog, SearchBar, Tab, TabList, TabPanel, TextInput } from '@sveltia/ui';
  import { createEventDispatcher, onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import AssetsPanel from '$lib/components/assets/shared/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import StockPhotoPanel from '$lib/components/assets/shared/stock-photo-panel.svelte';
  import { allAssets } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents';
  import { allPictureServices } from '$lib/services/integrations/pictures';
  import { prefs } from '$lib/services/prefs';
  import { generateUUID, stripSlashes } from '$lib/services/utils/strings';

  export let open = false;
  export let kind = undefined;
  export let canEnterURL = true;

  const dispatch = createEventDispatcher();
  const title = kind === 'image' ? $_('select_image') : $_('select_file');
  let tabName = 'upload';
  let tabPanelIdPrefix = '';
  /** @type {?SelectedAsset} */
  let selectedAsset = null;
  let enteredURL = '';
  let searchTerms = '';

  $: collectionMediaFolder = stripSlashes($selectedCollection.media_folder || '');

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
    {#if ['collection_files', 'all_files', ...Object.keys(allPictureServices)].includes(tabName)}
      <SearchBar bind:value={searchTerms} />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="footer-extra">
    {#if Object.keys(allPictureServices).includes(tabName) && $prefs?.apiKeys?.[tabName]}
      {@const { serviceLabel, landingURL } = allPictureServices[tabName]}
      <a href={landingURL}>
        {$_('prefs.media.stock_photo.credit', { values: { service: serviceLabel } })}
      </a>
    {/if}
  </svelte:fragment>
  <div class="wrapper">
    <TabList
      orientation="vertical"
      on:select={(/** @type {CustomEvent} */ event) => {
        tabName = event.detail.name;
      }}
    >
      <Tab
        name="upload"
        label={$_('upload')}
        aria-selected={true}
        aria-controls="{tabPanelIdPrefix}-upload"
      />
      {#if canEnterURL}
        <Tab name="enter_url" label={$_('enter_url')} aria-controls="{tabPanelIdPrefix}-url" />
      {/if}
      {#if collectionMediaFolder}
        <Tab
          name="collection_files"
          label={$_('collection_files')}
          aria-controls="{tabPanelIdPrefix}-collection-assets"
        />
      {/if}
      <Tab name="all_files" label={$_('all_files')} aria-controls="{tabPanelIdPrefix}-all-assets" />
      {#each Object.values(allPictureServices) as { serviceId, serviceLabel } (serviceId)}
        <Tab name={serviceId} label={serviceLabel} aria-controls="{tabPanelIdPrefix}-{serviceId}" />
      {/each}
    </TabList>
    <TabPanel id="{tabPanelIdPrefix}-upload">
      <DropZone
        accept={kind === 'image' ? 'image/*' : undefined}
        showUploadButton
        showFilePreview
        on:select={({ detail: { files } }) => {
          selectedAsset = files.length ? { file: files[0] } : null;
        }}
      />
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
    {#if collectionMediaFolder}
      <TabPanel id="{tabPanelIdPrefix}-collection-assets">
        <AssetsPanel
          assets={$allAssets.filter(
            (asset) => (!kind || kind === asset.kind) && collectionMediaFolder === asset.folder,
          )}
          {searchTerms}
          on:select={({ detail }) => {
            selectedAsset = detail;
          }}
        />
      </TabPanel>
    {/if}
    <TabPanel id="{tabPanelIdPrefix}-all-assets">
      <AssetsPanel
        assets={$allAssets.filter((asset) => !kind || kind === asset.kind)}
        {searchTerms}
        on:select={({ detail }) => {
          selectedAsset = detail;
        }}
      />
    </TabPanel>
    {#each Object.entries(allPictureServices) as [serviceId, props] (serviceId)}
      <TabPanel id="{tabPanelIdPrefix}-{serviceId}">
        {#if tabName === serviceId}
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
