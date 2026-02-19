<script>
  import {
    Button,
    Dialog,
    EmptyState,
    FilePicker,
    Icon,
    Listbox,
    Option,
    OptionGroup,
    SearchBar,
    Select,
    TextInput,
  } from '@sveltia/ui';
  import { getHash } from '@sveltia/utils/crypto';
  import { getPathInfo } from '@sveltia/utils/file';
  import { escapeRegExp } from '@sveltia/utils/string';
  import equal from 'fast-deep-equal';
  import { _ } from 'svelte-i18n';

  import CloudinaryPanel from '$lib/components/assets/browser/cloudinary-panel.svelte';
  import ExternalAssetsPanel from '$lib/components/assets/browser/external-assets-panel.svelte';
  import InternalAssetsPanel from '$lib/components/assets/browser/internal-assets-panel.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { allAssets } from '$lib/services/assets';
  import { selectAssetsView, showContentOverlay } from '$lib/services/contents/editor';
  import {
    convertFileItemToAsset,
    getUnsavedAssets,
  } from '$lib/services/contents/fields/file/process';
  import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
  import {
    allStockAssetProviders,
    getStockAssetMediaLibraryOptions,
  } from '$lib/services/integrations/media-libraries/stock';
  import { normalize } from '$lib/services/search/util';
  import { isSmallScreen } from '$lib/services/user/env';
  import { prefs } from '$lib/services/user/prefs';
  import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';

  /**
   * @import { Writable } from 'svelte/store';
   * @import {
   * Asset,
   * AssetFolderInfo,
   * AssetLibraryFolderMap,
   * AssetLibraryFolderMapKey,
   * EntryDraft,
   * MediaLibraryAssetKind,
   * SelectAssetsView,
   * SelectedResource,
   * } from '$lib/types/private';
   * @import { MediaField, StockAssetProviderName } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether to open the dialog.
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {MediaLibraryAssetKind} [kind] Asset kind.
   * @property {string | undefined} [accept] Accepted file type specifiers.
   * @property {boolean} [canEnterURL] Whether to allow entering a URL.
   * @property {Writable<EntryDraft | null | undefined>} [entryDraft] Associated entry draft.
   * @property {MediaField} [fieldConfig] Field configuration.
   * @property {AssetLibraryFolderMap} assetLibraryFolderMap Default asset library folder map.
   * @property {(resources: SelectedResource[]) => void} [onSelect] Custom `Select` event handler
   * that will be called when the dialog is closed with the Insert button.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    multiple = false,
    kind,
    // svelte-ignore state_referenced_locally
    accept = kind === 'image' ? SUPPORTED_IMAGE_TYPES.join(',') : undefined,
    canEnterURL = true,
    entryDraft,
    fieldConfig,
    assetLibraryFolderMap,
    onSelect = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const elementIdPrefix = $props.id();

  let enteredURL = $state('');
  let rawSearchTerms = $state('');
  let libraryName = $state('default-global');
  /** @type {Asset[]} */
  let droppedAssets = $state([]);
  /** @type {Asset[]} */
  let unsavedAssets = $state([]);
  /** @type {FilePicker | undefined} */
  let filePicker = $state();
  /** @type {SelectedResource[]} */
  let selectedResources = $state([]);
  /** @type {ExternalAssetsPanel | undefined} */
  let externalAssetsPanel = $state();

  const title = $derived(
    kind === 'image' ? $_('assets_dialog.title.image') : $_('assets_dialog.title.file'),
  );
  const searchTerms = $derived(normalize(rawSearchTerms));
  const isDefaultLibraryEnabled = $derived(
    Object.values(assetLibraryFolderMap).some(({ enabled }) => enabled),
  );
  const isDefaultLibrary = $derived(libraryName.startsWith('default-'));
  const selectedFolder = $derived.by(() => {
    if (!isDefaultLibrary) {
      return undefined;
    }

    const key = /** @type {AssetLibraryFolderMapKey} */ (libraryName.replace('default-', ''));
    const { folder } = assetLibraryFolderMap[key];

    return folder;
  });
  const targetFolderPath = $derived.by(() => {
    const { originalEntry } = $entryDraft ?? {};

    if (selectedFolder?.entryRelative && originalEntry) {
      // @todo FIXME: This only works with `media_folder: ""`
      return getPathInfo(Object.values(originalEntry.locales)[0].path).dirname;
    }

    return selectedFolder?.internalPath;
  });
  const targetFolderPathRegex = $derived(
    targetFolderPath !== undefined
      ? new RegExp(`^${escapeRegExp(targetFolderPath)}(?:\\/|$)`)
      : null,
  );
  const listedAssets = $derived(
    [...$allAssets, ...unsavedAssets]
      .filter((asset) => !kind || kind === asset.kind)
      .sort((a, b) => a.name.localeCompare(b.name))
      // Unsaved assets should go first
      .sort((a, b) => Number(!!b.unsaved) - Number(!!a.unsaved)),
  );
  const enabledStockAssetProviderEntries = $derived.by(() => {
    const { providers = [] } = getStockAssetMediaLibraryOptions({ fieldConfig });

    return Object.entries(allStockAssetProviders).filter(
      ([serviceId, { hotlinking }]) =>
        providers.includes(/** @type {StockAssetProviderName} */ (serviceId)) &&
        // When hotlinking is not required, files are downloaded and then uploaded to the
        // repository, so the default library has to be configured.
        (hotlinking || isDefaultLibraryEnabled),
    );
  });
  const isEnabledMediaService = $derived(
    enabledStockAssetProviderEntries
      .map(([serviceId]) => serviceId)
      .includes(/** @type {StockAssetProviderName} */ (libraryName)) &&
      !!$prefs?.apiKeys?.[libraryName],
  );
  const enabledCloudServiceEntries = $derived(
    Object.entries(allCloudStorageServices).filter(([, { isEnabled }]) => isEnabled?.() ?? true),
  );
  const enabledExternalServiceEntries = $derived([
    ...enabledCloudServiceEntries,
    ...enabledStockAssetProviderEntries,
  ]);
  const isCloudLibrary = $derived(
    enabledCloudServiceEntries.map(([serviceId]) => serviceId).includes(libraryName),
  );
  const isStockLibrary = $derived(
    enabledStockAssetProviderEntries
      .map(([serviceId]) => serviceId)
      .includes(/** @type {any} */ (libraryName)),
  );
  const Selector = $derived($isSmallScreen ? Select : Listbox);

  /**
   * Check if an asset is in the selected folder.
   * @param {Asset} asset Asset to check.
   * @returns {boolean} `true` if the asset is in the selected folder.
   */
  const isAssetInSelectedFolder = (asset) => {
    if (
      selectedFolder === undefined ||
      asset.folder?.internalPath !== selectedFolder.internalPath ||
      asset.folder?.entryRelative !== selectedFolder.entryRelative
    ) {
      return false;
    }

    if (!selectedFolder.entryRelative) {
      return true;
    }

    const { dirname } = getPathInfo(asset.path);

    if (dirname === undefined || !targetFolderPathRegex) {
      return false;
    }

    return targetFolderPathRegex.test(dirname);
  };

  /**
   * Check if an asset with the same hash and folder already exists in the unsaved assets.
   * @param {object} args Arguments.
   * @param {string} args.hash Hash of the file.
   * @param {AssetFolderInfo | undefined} args.folder Asset folder.
   * @returns {Promise<boolean>} `true` if the asset already exists.
   */
  const hasSameAsset = async ({ hash, folder }) => {
    const results = await Promise.all(
      unsavedAssets.map(
        async (asset) =>
          !!asset.file && equal(asset.folder, folder) && (await getHash(asset.file)) === hash,
      ),
    );

    return results.includes(true);
  };

  /**
   * Process a dropped file.
   * @param {File} file File to be processed.
   * @returns {Promise<SelectedResource | undefined>} Processed asset or `undefined` if the file
   * already exists.
   */
  const processFile = async (file) => {
    const hash = await getHash(file);
    const folder = selectedFolder;

    if (await hasSameAsset({ hash, folder })) {
      return undefined;
    }

    const asset = await convertFileItemToAsset({ file, folder, targetFolderPath });

    droppedAssets.push(asset);

    return { asset };
  };

  /**
   * Handle dropped files.
   * @param {File[]} files File list.
   */
  const onDrop = async (files) => {
    selectedResources = (await Promise.all(files.map(processFile))).filter((r) => !!r);
  };

  /**
   * Reset all the values.
   */
  const resetValues = () => {
    enteredURL = '';
    rawSearchTerms = '';
    droppedAssets = [];
    unsavedAssets = [];
    selectedResources = [];
  };

  /**
   * Handle the OK button click.
   */
  const onOk = () => {
    if (!selectedResources.length) {
      return;
    }

    const resources = $state.snapshot(selectedResources).map((resource) => {
      const { unsaved, file, folder } = resource.asset ?? {};

      return unsaved ? { file, folder } : resource;
    });

    onSelect?.(resources);
  };

  $effect.pre(() => {
    const firstDefaultLibraryId = Object.entries(assetLibraryFolderMap).find(
      ([, { enabled }]) => enabled,
    )?.[0];

    if (firstDefaultLibraryId) {
      // Select the first enabled folder
      libraryName = `default-${firstDefaultLibraryId}`;
    } else {
      // Select the first available external service
      libraryName = enabledExternalServiceEntries[0]?.[0];
    }
  });

  $effect(() => {
    void $entryDraft?.files;
    // Somehow we need to snapshot `droppedAssets` here to make Svelte aware of its changes
    void $state.snapshot(droppedAssets);

    (async () => {
      unsavedAssets = [
        ...($entryDraft?.files
          ? await getUnsavedAssets({ draft: $entryDraft, targetFolderPath })
          : []),
        ...Object.values(droppedAssets),
      ];
    })();
  });

  $effect(() => {
    if (!$showContentOverlay) {
      open = false;
    }
  });
</script>

{#snippet headerItems()}
  {#if isDefaultLibrary || (isCloudLibrary && libraryName !== 'cloudinary') || isStockLibrary}
    {#if $selectAssetsView}
      <ViewSwitcher
        currentView={(() => /** @type {Writable<SelectAssetsView>} */ (selectAssetsView))()}
        aria-controls="select-assets-grid"
      />
    {/if}
    <SearchBar
      flex={$isSmallScreen}
      bind:value={rawSearchTerms}
      disabled={selectedResources.some((r) => r.file)}
      aria-label={$_(`assets_dialog.search_for_${kind ?? 'file'}`)}
    />
  {/if}
  {#if isDefaultLibrary || (isCloudLibrary && libraryName !== 'cloudinary')}
    <Button
      variant="primary"
      label={$_('upload')}
      onclick={() => {
        filePicker?.open();
      }}
    >
      {#snippet startIcon()}
        <Icon name="cloud_upload" />
      {/snippet}
    </Button>
  {/if}
{/snippet}

<Dialog
  {title}
  size="x-large"
  okLabel={$_('insert')}
  okDisabled={!selectedResources.length}
  keepContent={true}
  focusInput={false}
  bind:open
  {onOk}
  onClose={() => {
    resetValues();
  }}
>
  {#snippet headerExtra()}
    {#if !$isSmallScreen}
      {@render headerItems()}
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
          selectedResources = [];
        }}
      >
        {#if isDefaultLibraryEnabled}
          <OptionGroup label={$_('asset_location.repository')}>
            {#each Object.entries(assetLibraryFolderMap) as [id, { enabled }] (id)}
              {#if enabled}
                {@const name = `default-${id}`}
                <Option
                  {name}
                  label={$_(`assets_dialog.folder.${id}`)}
                  selected={libraryName === name}
                />
              {/if}
            {/each}
          </OptionGroup>
        {/if}
        {#if canEnterURL || !!Object.keys(enabledCloudServiceEntries).length}
          <OptionGroup label={$_('asset_location.external')}>
            {#each enabledCloudServiceEntries as [, { serviceId, serviceLabel }] (serviceId)}
              <Option name={serviceId} label={serviceLabel} selected={libraryName === serviceId} />
            {/each}
            {#if canEnterURL}
              <Option
                name="enter-url"
                label={$_('assets_dialog.enter_url')}
                selected={libraryName === 'enter-url'}
              />
            {/if}
          </OptionGroup>
        {/if}
        {#if enabledStockAssetProviderEntries.length}
          <OptionGroup label={$_('asset_location.stock_photos')}>
            {#each enabledStockAssetProviderEntries as [serviceId, { serviceLabel }] (serviceId)}
              <Option name={serviceId} label={serviceLabel} selected={libraryName === serviceId} />
            {/each}
          </OptionGroup>
        {/if}
      </Selector>
      {#if $isSmallScreen}
        <div role="none" class="filter-tools">
          {@render headerItems()}
        </div>
      {/if}
    </div>
    <div role="none" id="{elementIdPrefix}-content-pane" class="content-pane">
      {#if isDefaultLibrary && selectedFolder}
        <InternalAssetsPanel
          {accept}
          {multiple}
          assets={listedAssets.filter(isAssetInSelectedFolder)}
          bind:selectedResources
          {searchTerms}
          basePath={selectedFolder.internalPath}
          onDrop={({ files }) => {
            onDrop(files);
          }}
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
              const url = enteredURL.trim();

              selectedResources = url ? [{ url }] : [];
            }}
          />
        </EmptyState>
      {/if}
      {#each enabledExternalServiceEntries as [serviceId, serviceProps] (serviceId)}
        {#if serviceId === 'cloudinary'}
          <!-- Always include the Cloudinary panel in the DOM, otherwise the iframe will be
            destroyed when the component is unmounted and the user has to sign in again due to the
            third-party cookie limitation. The `keepContent` prop on the `<Dialog>` is also needed
            for that reason -->
          <CloudinaryPanel
            {kind}
            {fieldConfig}
            {multiple}
            hidden={libraryName !== 'cloudinary'}
            onSelect={(resources) => {
              // Check if the dialog is open to prevent selected resources from being inserted to
              // other fields. This is required because `CloudinaryPanel` uses messaging to
              // communicate with the embedded iframe, which is shared by all fields using the
              // Cloudinary media storage.
              if (!open) {
                return;
              }

              // Close the dialog after selection
              selectedResources = resources;
              onOk();
              open = false;
            }}
          />
        {:else if libraryName === serviceId}
          <ExternalAssetsPanel
            {kind}
            {fieldConfig}
            {multiple}
            {searchTerms}
            {serviceProps}
            gridId="select-assets-grid"
            bind:selectedResources
            bind:this={externalAssetsPanel}
          />
        {/if}
      {/each}
    </div>
  </div>
</Dialog>

<FilePicker
  bind:this={filePicker}
  {accept}
  {multiple}
  onSelect={({ files }) => {
    if (isCloudLibrary) {
      externalAssetsPanel?.uploadFiles(files);
    } else {
      onDrop(files);
    }
  }}
/>

<style lang="scss">
  .wrapper {
    display: flex;
    gap: 16px;
    height: 60dvh;
    max-height: 800px;

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
