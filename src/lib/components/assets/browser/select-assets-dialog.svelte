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
  import equal from 'fast-deep-equal';
  import { _ } from 'svelte-i18n';
  import ExternalAssetsPanel from '$lib/components/assets/browser/external-assets-panel.svelte';
  import InternalAssetsPanel from '$lib/components/assets/browser/internal-assets-panel.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import { allAssets, getAssetFolder, getAssetKind, globalAssetFolder } from '$lib/services/assets';
  import { getStockAssetMediaLibraryOptions } from '$lib/services/assets/media-library';
  import { selectAssetsView, showContentOverlay } from '$lib/services/contents/draft/editor';
  import {
    allCloudStorageServices,
    allStockAssetProviders,
  } from '$lib/services/integrations/media-libraries';
  import { normalize } from '$lib/services/search';
  import { isSmallScreen } from '$lib/services/user/env';
  import { prefs } from '$lib/services/user/prefs';
  import { supportedImageTypes } from '$lib/services/utils/media/image';

  /**
   * @import { Writable } from 'svelte/store';
   * @import {
   * Asset,
   * AssetFolderInfo,
   * AssetKind,
   * EntryDraft,
   * EntryFileMap,
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
   * @property {Writable<EntryDraft | null | undefined>} [entryDraft] Associated entry draft.
   * @property {FileField | ImageField} [fieldConfig] Field configuration.
   * @property {(resource: SelectedResource) => void} [onSelect] Custom `Select` event handler that
   * will be called when the dialog is closed with the Insert button.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    kind,
    accept = kind === 'image' ? supportedImageTypes.join(',') : undefined,
    canEnterURL = true,
    entryDraft,
    fieldConfig,
    onSelect = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const elementIdPrefix = $props.id();

  /** @type {SelectedResource | undefined} */
  let selectedResource = $state();
  let enteredURL = $state('');
  let rawSearchTerms = $state('');
  let libraryName = $state('default-global');
  /** @type {EntryFileMap} */
  let droppedFiles = $state({});
  /** @type {Asset[]} */
  let unsavedAssets = $state([]);
  /** @type {FilePicker | undefined} */
  let filePicker = $state();

  const title = $derived(
    kind === 'image' ? $_('assets_dialog.title.image') : $_('assets_dialog.title.file'),
  );
  const searchTerms = $derived(normalize(rawSearchTerms));
  /** @type {Record<string, { folder: AssetFolderInfo | undefined, enabled: boolean }>} */
  const allDefaultLibraryFolders = $derived.by(() => {
    const collectionName = $entryDraft?.collectionName ?? '';
    const fileName = $entryDraft?.fileName;
    const fileAssetFolder = getAssetFolder({ collectionName, fileName });
    const collectionAssetFolder = getAssetFolder({ collectionName });
    const entryAssetFolder = fileAssetFolder ?? collectionAssetFolder;

    return {
      entry: {
        folder: entryAssetFolder,
        enabled:
          !!entryAssetFolder &&
          (entryAssetFolder.entryRelative || entryAssetFolder.hasTemplateTags),
      },
      file: {
        folder: fileAssetFolder,
        enabled:
          !!fileAssetFolder && !fileAssetFolder.entryRelative && !fileAssetFolder.hasTemplateTags,
      },
      collection: {
        folder: collectionAssetFolder,
        enabled:
          !!collectionAssetFolder &&
          !collectionAssetFolder.entryRelative &&
          !collectionAssetFolder.hasTemplateTags,
      },
      global: {
        folder: $globalAssetFolder,
        enabled: true,
      },
    };
  });
  const entryDirName = $derived.by(() => {
    const entry = $entryDraft?.originalEntry;

    return entry ? getPathInfo(Object.values(entry.locales)[0].path).dirname : undefined;
  });
  const isDefaultLibrary = $derived(libraryName.startsWith('default-'));
  const selectedFolder = $derived(
    isDefaultLibrary
      ? allDefaultLibraryFolders[libraryName.replace('default-', '')].folder
      : undefined,
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
  const enabledCloudServiceEntries = $derived(Object.entries(allCloudStorageServices));
  const enabledExternalServiceEntries = $derived([
    ...enabledStockAssetProviderEntries,
    ...enabledCloudServiceEntries,
  ]);
  const Selector = $derived($isSmallScreen ? Select : Listbox);

  /**
   * Convert unsaved files to the `Asset` format so these can be browsed just like other assets.
   * @returns {Promise<Asset[]>} Assets.
   */
  const getUnsavedAssets = async () =>
    Promise.all(
      [...Object.entries($entryDraft?.files ?? {}), ...Object.entries(droppedFiles)].map(
        async ([blobURL, { file, folder }]) => {
          const { name, size } = file;

          return /** @type {Asset} */ ({
            unsaved: true,
            file,
            blobURL,
            name,
            path: `${folder?.internalPath}/${name}`,
            sha: await getHash(file),
            size,
            kind: getAssetKind(name),
            folder,
          });
        },
      ),
    );

  /**
   * Handle dropped files.
   * @param {File[]} files File list.
   */
  const onDrop = (files) => {
    files.forEach(async (file, index) => {
      const hash = await getHash(file);
      const folder = selectedFolder;
      const resource = { file, folder };

      const hasExistingResource = (
        await Promise.all(
          unsavedAssets.map(
            async (a) => !!a.file && (await getHash(a.file)) === hash && equal(a.folder, folder),
          ),
        )
      ).some(Boolean);

      if (hasExistingResource) {
        return;
      }

      droppedFiles[URL.createObjectURL(file)] = resource;

      if (index === 0) {
        selectedResource = resource;
      }
    });
  };

  $effect.pre(() => {
    // Select the first enabled folder
    const id = Object.entries(allDefaultLibraryFolders).find(([, { enabled }]) => enabled)?.[0];

    libraryName = `default-${id}`;
  });

  $effect(() => {
    void $entryDraft?.files;
    void droppedFiles;

    (async () => {
      unsavedAssets = await getUnsavedAssets();
    })();
  });

  $effect(() => {
    if (!$showContentOverlay) {
      open = false;
    }
  });
</script>

{#snippet headerItems()}
  {#if isDefaultLibrary || isEnabledMediaService}
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
  {#if isDefaultLibrary}
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
  size={'x-large'}
  okLabel={$_('insert')}
  okDisabled={!selectedResource}
  bind:open
  onOk={() => {
    if (selectedResource) {
      const resource = $state.snapshot(selectedResource);
      const { unsaved, file, folder } = resource.asset ?? {};

      onSelect?.(unsaved ? { file, folder } : resource);
    }
  }}
  onClose={() => {
    // Reset values
    enteredURL = '';
    rawSearchTerms = '';
    droppedFiles = {};
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
          selectedResource = undefined;
        }}
      >
        <OptionGroup label={$_('assets_dialog.location.repository')}>
          {#each Object.entries(allDefaultLibraryFolders) as [id, { enabled }] (id)}
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
          {@render headerItems()}
        </div>
      {/if}
    </div>
    <div role="none" id="{elementIdPrefix}-content-pane" class="content-pane">
      {#if isDefaultLibrary && selectedFolder}
        <InternalAssetsPanel
          {accept}
          assets={listedAssets.filter((asset) =>
            selectedFolder.entryRelative
              ? getPathInfo(asset.path).dirname === entryDirName
              : equal(asset.folder, selectedFolder),
          )}
          bind:selectedResource
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

              selectedResource = url ? { url } : undefined;
            }}
          />
        </EmptyState>
      {/if}
      {#each enabledExternalServiceEntries as [serviceId, serviceProps] (serviceId)}
        {#if libraryName === serviceId}
          <ExternalAssetsPanel
            {kind}
            {searchTerms}
            {serviceProps}
            gridId="select-assets-grid"
            onSelect={(resource) => {
              selectedResource = resource;
            }}
          />
        {/if}
      {/each}
    </div>
  </div>
</Dialog>

<FilePicker
  bind:this={filePicker}
  {accept}
  onSelect={({ files }) => {
    onDrop(files);
  }}
/>

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
