<script>
  import { Dialog, Listbox, Option, OptionGroup, SearchBar, TextInput } from '@sveltia/ui';
  import { generateUUID } from '@sveltia/utils/crypto';
  import { getPathInfo } from '@sveltia/utils/file';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import ExternalAssetsPanel from '$lib/components/assets/shared/external-assets-panel.svelte';
  import InternalAssetsPanel from '$lib/components/assets/shared/internal-assets-panel.svelte';
  import EmptyState from '$lib/components/common/empty-state.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { allAssets, globalAssetFolder } from '$lib/services/assets';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { selectAssetsView, showContentOverlay } from '$lib/services/contents/draft/editor';
  import {
    allCloudStorageServices,
    allStockPhotoServices,
  } from '$lib/services/integrations/media-libraries';
  import { prefs } from '$lib/services/prefs';
  import { normalize } from '$lib/services/search';

  /**
   * @typedef {object} Props
   * @property {boolean} [open] - Whether to open the dialog.
   * @property {AssetKind | undefined} [kind] - Asset kind.
   * @property {boolean} [canEnterURL] - Whether to allow entering a URL.
   * @property {Entry} [entry] - Associated entry.
   * @property {(detail: { asset: SelectedAsset }) => void} [onSelect] - Custom `select` event
   * handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    kind,
    canEnterURL = true,
    entry,
    onSelect = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  let elementIdPrefix = $state('');
  /** @type {SelectedAsset | null} */
  let selectedAsset = $state(null);
  let enteredURL = $state('');
  let rawSearchTerms = $state('');
  let libraryName = $state('uncategorized-assets');

  const title = $derived(
    kind === 'image' ? $_('assets_dialog.title.image') : $_('assets_dialog.title.file'),
  );
  const searchTerms = $derived(normalize(rawSearchTerms));
  const { internalPath = '', entryRelative = false } = $derived(
    $selectedCollection?._assetFolder ?? /** @type {any} */ ({}),
  );
  const showCollectionAssets = $derived(!!internalPath && !entryRelative);
  const showEntryAssets = $derived(!!entry && entryRelative);
  const showUploader = $derived(libraryName === 'upload');
  const entryDirName = $derived(
    entry ? getPathInfo(Object.values(entry.locales)[0].path).dirname : undefined,
  );
  const isLocalLibrary = $derived(libraryName.endsWith('-assets'));
  const isEnabledMediaService = $derived(
    (Object.keys(allStockPhotoServices).includes(libraryName) && $prefs?.apiKeys?.[libraryName]) ||
      (Object.keys(allCloudStorageServices).includes(libraryName) && $prefs?.logins?.[libraryName]),
  );

  onMount(() => {
    elementIdPrefix = `library-${generateUUID('short')}`;
  });

  $effect(() => {
    libraryName = showEntryAssets
      ? 'entry-assets'
      : showCollectionAssets
        ? 'collection-assets'
        : 'uncategorized-assets';
  });

  $effect(() => {
    if (open) {
      // Reset values
      enteredURL = '';
    }
  });

  $effect(() => {
    if (!$showContentOverlay) {
      open = false;
    }
  });
</script>

<Dialog
  {title}
  size={'x-large'}
  okLabel={$_('insert')}
  okDisabled={!selectedAsset}
  bind:open
  onOk={() => {
    onSelect?.({ asset: /** @type {SelectedAsset} */ (selectedAsset) });
  }}
>
  {#snippet headerExtra()}
    {#if isLocalLibrary || isEnabledMediaService}
      {#if $selectAssetsView}
        <ViewSwitcher
          currentView={(() =>
            /** @type {import('svelte/store').Writable<SelectAssetsView>} */ (selectAssetsView))()}
          aria-controls="select-assets-grid"
        />
      {/if}
      <SearchBar
        bind:value={rawSearchTerms}
        disabled={!!selectedAsset?.file}
        aria-label={$_(`assets_dialog.search_for_${kind ?? 'file'}`)}
      />
    {/if}
  {/snippet}
  {#snippet footerExtra()}
    {#if isEnabledMediaService}
      {@const { showServiceLink, serviceLabel, serviceURL } =
        allStockPhotoServices[libraryName] ?? {}}
      {#if showServiceLink}
        <a href={serviceURL}>
          {$_('prefs.media.stock_photos.credit', { values: { service: serviceLabel } })}
        </a>
      {/if}
    {/if}
  {/snippet}
  <div role="none" class="wrapper">
    <Listbox
      class="tabs"
      aria-label={$_('assets_dialog.locations')}
      aria-controls="{elementIdPrefix}-content-pane"
      onChange={(event) => {
        libraryName = /** @type {CustomEvent} */ (event).detail.name;
        selectedAsset = null;
      }}
    >
      <OptionGroup label={$_('assets_dialog.location.repository')}>
        {#if showEntryAssets}
          <Option
            name="entry-assets"
            label={$_('entry_assets')}
            selected={libraryName === 'entry-assets'}
          />
        {/if}
        {#if showCollectionAssets}
          <Option
            name="collection-assets"
            label={$_('collection_assets')}
            selected={libraryName === 'collection-assets'}
          />
        {/if}
        <Option
          name="uncategorized-assets"
          label={$_('uncategorized')}
          selected={libraryName === 'uncategorized-assets'}
        />
      </OptionGroup>
      <OptionGroup label={$_('assets_dialog.location.local')}>
        <Option name="upload" label={$_('upload')} selected={showUploader} />
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
      {#if showEntryAssets && (libraryName === 'entry-assets' || showUploader)}
        <InternalAssetsPanel
          {kind}
          assets={$allAssets.filter(
            (asset) =>
              (!kind || kind === asset.kind) && getPathInfo(asset.path).dirname === entryDirName,
          )}
          bind:selectedAsset
          {showUploader}
          {searchTerms}
        />
      {:else if showCollectionAssets && (libraryName === 'collection-assets' || showUploader)}
        <InternalAssetsPanel
          {kind}
          assets={$allAssets.filter(
            (asset) => (!kind || kind === asset.kind) && asset.folder === internalPath,
          )}
          bind:selectedAsset
          {showUploader}
          {searchTerms}
        />
      {:else if libraryName === 'uncategorized-assets' || showUploader}
        <InternalAssetsPanel
          {kind}
          assets={$allAssets.filter(
            (asset) =>
              (!kind || kind === asset.kind) && asset.folder === $globalAssetFolder?.internalPath,
          )}
          bind:selectedAsset
          {showUploader}
          {searchTerms}
        />
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
            oninput={() => {
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
            onSelect={(detail) => {
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
            onSelect={(detail) => {
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
