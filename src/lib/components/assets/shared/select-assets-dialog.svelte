<script>
  import {
    Button,
    Dialog,
    Group,
    Listbox,
    Option,
    OptionGroup,
    SearchBar,
    TextInput,
  } from '@sveltia/ui';
  import { createEventDispatcher, onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import AssetsPanel from '$lib/components/assets/shared/assets-panel.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import ExternalAssetsPanel from '$lib/components/assets/shared/external-assets-panel.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { allAssets } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents';
  import { selectAssetsView } from '$lib/services/contents/editor';
  import {
    allCloudStorageServices,
    allStockPhotoServices,
  } from '$lib/services/integrations/media-libraries';
  import { prefs } from '$lib/services/prefs';
  import { generateUUID, stripSlashes } from '$lib/services/utils/strings';

  export let open = false;
  /**
   * @type {'image' | 'any'}
   */
  export let kind = 'image';
  export let canEnterURL = true;

  const dispatch = createEventDispatcher();
  const title = kind === 'image' ? $_('assets_dialog.title.image') : $_('assets_dialog.title.file');
  /**
   * @type {import('svelte').SvelteComponent}
   */
  let collectionAssetsDropZone = undefined;
  /**
   * @type {import('svelte').SvelteComponent}
   */
  let allAssetsDropZone = undefined;
  let elementIdPrefix = '';
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
    (Object.keys(allStockPhotoServices).includes(libraryName) && $prefs?.apiKeys?.[libraryName]) ||
    (Object.keys(allCloudStorageServices).includes(libraryName) && $prefs?.logins?.[libraryName]);

  $: {
    if (open) {
      // Reset values
      enteredURL = '';
    }
  }

  onMount(() => {
    elementIdPrefix = `library-${generateUUID().split('-').pop()}`;
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
      <ViewSwitcher currentView={selectAssetsView} />
      <SearchBar bind:value={searchTerms} disabled={!!selectedAsset?.file} />
    {/if}
  </svelte:fragment>
  <svelte:fragment slot="footer-extra">
    {#if isEnabledMediaService}
      {@const { showServiceLink, serviceLabel, serviceURL } =
        allStockPhotoServices[libraryName] || {}}
      {#if showServiceLink}
        <a href={serviceURL}>
          {$_('prefs.media.stock_photo.credit', { values: { service: serviceLabel } })}
        </a>
      {/if}
    {/if}
  </svelte:fragment>
  <div class="wrapper">
    <Listbox
      aria-controls="{elementIdPrefix}-content-pane"
      class="tabs"
      on:select={(/** @type {CustomEvent} */ event) => {
        libraryName = event.detail.name;
        selectedAsset = null;
      }}
    >
      <OptionGroup label={$_('assets_dialog.location.this_repository')}>
        {#if collectionMediaFolder}
          <Option
            name="collection-files"
            label={$_('collection_files')}
            aria-selected={libraryName === 'collection-files'}
          />
        {/if}
        <Option
          name="all-files"
          label={$_('all_files')}
          aria-selected={libraryName === 'all-files'}
        />
      </OptionGroup>
      <OptionGroup label={$_('assets_dialog.location.external_locations')}>
        {#if canEnterURL}
          <Option name="enter-url" label={$_('assets_dialog.enter_url')} />
        {/if}
        {#each Object.values(allCloudStorageServices) as { serviceId, serviceLabel } (serviceId)}
          <Option name={serviceId} label={serviceLabel} />
        {/each}
      </OptionGroup>
      <OptionGroup label={$_('assets_dialog.location.stock_photos')}>
        {#each Object.values(allStockPhotoServices) as { serviceId, serviceLabel } (serviceId)}
          <Option name={serviceId} label={serviceLabel} />
        {/each}
      </OptionGroup>
    </Listbox>
    <Group id="{elementIdPrefix}-content-pane" class="content-pane">
      {#if collectionMediaFolder && libraryName === 'collection-files'}
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
      {/if}
      {#if libraryName === 'all-files'}
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
      {/if}
      {#if canEnterURL && libraryName === 'enter-url'}
        <EmptyState>
          <div>
            {kind === 'image'
              ? $_('assets_dialog.enter_image_url')
              : $_('assets_dialog.enter_file_url')}
          </div>
          <TextInput
            bind:value={enteredURL}
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
            on:select={({ detail }) => {
              selectedAsset = detail;
            }}
          />
        {/if}
      {/each}
    </Group>
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

    :global(.content-pane) {
      overflow: auto;
      flex: auto;
    }
  }
</style>
