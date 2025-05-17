<script>
  import {
    Dialog,
    EmptyState,
    Listbox,
    Option,
    OptionGroup,
    SearchBar,
    Select,
    TextInput,
  } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';
  import { _ } from 'svelte-i18n';
  import ExternalAssetsPanel from '$lib/components/assets/browser/external-assets-panel.svelte';
  import InternalAssetsPanel from '$lib/components/assets/browser/internal-assets-panel.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { allAssets, getAssetFolder, globalAssetFolder } from '$lib/services/assets';
  import { getStockAssetMediaLibraryOptions } from '$lib/services/assets/media-library';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { selectAssetsView, showContentOverlay } from '$lib/services/contents/draft/editor';
  import {
    allCloudStorageServices,
    allStockAssetProviders,
  } from '$lib/services/integrations/media-libraries';
  import { normalize } from '$lib/services/search';
  import { isSmallScreen } from '$lib/services/user/env';
  import { prefs } from '$lib/services/user/prefs';

  /**
   * @import { Writable } from 'svelte/store';
   * @import {
   * AssetKind,
   * Entry,
   * MediaLibraryService,
   * SelectAssetsView,
   * SelectedResource,
   * } from '$lib/types/private';
   * @import { FileField, ImageField, StockAssetProviderName } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether to open the dialog.
   * @property {AssetKind | undefined} [kind] Asset kind.
   * @property {string | undefined} [accept] Accepted file type specifiers.
   * @property {boolean} [canEnterURL] Whether to allow entering a URL.
   * @property {Entry} [entry] Associated entry.
   * @property {FileField | ImageField} [fieldConfig] Field configuration.
   * @property {(resource: SelectedResource) => void} [onSelect] Custom `Select` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    kind,
    accept = undefined,
    canEnterURL = true,
    entry,
    fieldConfig,
    onSelect = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const elementIdPrefix = $props.id();

  /** @type {SelectedResource | null} */
  let selectedResource = $state(null);
  let enteredURL = $state('');
  let rawSearchTerms = $state('');
  let libraryName = $state('uncategorized-assets');

  const title = $derived(
    kind === 'image' ? $_('assets_dialog.title.image') : $_('assets_dialog.title.file'),
  );
  const searchTerms = $derived(normalize(rawSearchTerms));
  const { internalPath, entryRelative, hasTemplateTags } = $derived(
    getAssetFolder({ collectionName: $selectedCollection?.name }) ?? {
      internalPath: '',
      entryRelative: false,
      hasTemplateTags: false,
    },
  );
  const showCollectionAssets = $derived(!!internalPath && !entryRelative && !hasTemplateTags);
  const showEntryAssets = $derived(!!entry && (entryRelative || hasTemplateTags));
  const showUploader = $derived(libraryName === 'upload');
  const entryDirName = $derived(
    entry ? getPathInfo(Object.values(entry.locales)[0].path).dirname : undefined,
  );
  const isLocalLibrary = $derived(libraryName?.endsWith('-assets') ?? true);
  const enabledStockAssetProviderEntries = $derived.by(() => {
    const { providers = [] } = getStockAssetMediaLibraryOptions({ fieldConfig });

    return /** @type {[StockAssetProviderName, MediaLibraryService][]} */ (
      Object.entries(allStockAssetProviders)
    ).filter(([serviceId]) => providers.includes(serviceId));
  });
  const isEnabledMediaService = $derived(
    (enabledStockAssetProviderEntries
      .map(([serviceId]) => serviceId)
      .includes(/** @type {StockAssetProviderName} */ (libraryName)) &&
      $prefs?.apiKeys?.[libraryName]) ||
      (Object.keys(allCloudStorageServices).includes(libraryName) && $prefs?.logins?.[libraryName]),
  );
  const Selector = $derived($isSmallScreen ? Select : Listbox);

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

{#snippet filterTools()}
  {#if isLocalLibrary || isEnabledMediaService}
    {#if $selectAssetsView}
      <ViewSwitcher
        currentView={(() => /** @type {Writable<SelectAssetsView>} */ (selectAssetsView))()}
        aria-controls="select-assets-grid"
      />
    {/if}
    <SearchBar
      flex={$isSmallScreen}
      bind:value={rawSearchTerms}
      disabled={!!selectedResource?.file}
      aria-label={$_(`assets_dialog.search_for_${kind ?? 'file'}`)}
    />
  {/if}
{/snippet}

<Dialog
  {title}
  size={'x-large'}
  okLabel={$_('insert')}
  okDisabled={!selectedResource}
  bind:open
  onOk={() => {
    if (selectedResource) {
      onSelect?.(selectedResource);
    }
  }}
>
  {#snippet headerExtra()}
    {#if !$isSmallScreen}
      {@render filterTools()}
    {/if}
  {/snippet}
  {#snippet footerExtra()}
    {#if isEnabledMediaService}
      {@const { showServiceLink, serviceLabel, serviceURL } =
        allStockAssetProviders[/** @type {StockAssetProviderName} */ (libraryName)] ?? {}}
      {#if showServiceLink}
        <a href={serviceURL}>
          {$_('prefs.media.stock_photos.credit', { values: { service: serviceLabel } })}
        </a>
      {/if}
    {/if}
  {/snippet}
  <div role="none" class="wrapper">
    <div role="none" class="nav">
      <Selector
        class="tabs"
        aria-label={$_('assets_dialog.locations')}
        aria-controls="{elementIdPrefix}-content-pane"
        filterThreshold={-1}
        onChange={(event) => {
          libraryName = event.detail.name;
          selectedResource = null;
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
            {#each Object.values(allCloudStorageServices) as service (service.serviceId)}
              {@const { serviceId, serviceLabel } = service}
              <Option name={serviceId} label={serviceLabel} />
            {/each}
          </OptionGroup>
        {/if}
        {#if enabledStockAssetProviderEntries.length}
          <OptionGroup label={$_('assets_dialog.location.stock_photos')}>
            {#each enabledStockAssetProviderEntries as [serviceId, { serviceLabel }] (serviceId)}
              <Option name={serviceId} label={serviceLabel} />
            {/each}
          </OptionGroup>
        {/if}
      </Selector>
      {#if $isSmallScreen}
        <div role="none" class="filter-tools">
          {@render filterTools()}
        </div>
      {/if}
    </div>
    <div role="none" id="{elementIdPrefix}-content-pane" class="content-pane">
      {#if showEntryAssets && (libraryName === 'entry-assets' || showUploader)}
        <InternalAssetsPanel
          {kind}
          {accept}
          assets={$allAssets.filter(
            (asset) =>
              (!kind || kind === asset.kind) &&
              (entryRelative
                ? getPathInfo(asset.path).dirname === entryDirName
                : asset.folder === internalPath),
          )}
          bind:selectedResource
          {showUploader}
          {searchTerms}
        />
      {:else if showCollectionAssets && (libraryName === 'collection-assets' || showUploader)}
        <InternalAssetsPanel
          {kind}
          {accept}
          assets={$allAssets.filter(
            (asset) => (!kind || kind === asset.kind) && asset.folder === internalPath,
          )}
          bind:selectedResource
          {showUploader}
          {searchTerms}
          basePath={internalPath}
        />
      {:else if libraryName === 'uncategorized-assets' || showUploader}
        <InternalAssetsPanel
          {kind}
          {accept}
          assets={$allAssets.filter(
            (asset) =>
              (!kind || kind === asset.kind) && asset.folder === $globalAssetFolder?.internalPath,
          )}
          bind:selectedResource
          {showUploader}
          {searchTerms}
          basePath={$globalAssetFolder?.internalPath}
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
              selectedResource = enteredURL.trim() ? { url: enteredURL.trim() } : null;
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
              selectedResource = detail;
            }}
          />
        {/if}
      {/each}
      {#each enabledStockAssetProviderEntries as [serviceId, serviceProps] (serviceId)}
        {#if libraryName === serviceId}
          <ExternalAssetsPanel
            {kind}
            {searchTerms}
            {serviceProps}
            gridId="select-assets-grid"
            onSelect={(detail) => {
              selectedResource = detail;
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
    height: 60dvh;

    @media (width < 768px) {
      flex-direction: column;
      overflow: hidden;
      height: 72dvh;
    }

    .nav {
      display: flex;
      gap: 4px;

      @media (width < 768px) {
        flex-direction: column;
      }
    }

    :global(.listbox) {
      flex: none;
      background-color: transparent;
    }

    .content-pane {
      overflow: auto;
      flex: auto;
    }
  }

  .filter-tools {
    display: flex;
    gap: 8px;
  }
</style>
