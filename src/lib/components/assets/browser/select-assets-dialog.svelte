<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Dialog, EmptyState, FilePicker, Icon, SearchBar, TextInput } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import CloudinaryPanel from '$lib/components/assets/browser/cloudinary-panel.svelte';
  import ExternalAssetsPanel from '$lib/components/assets/browser/external-assets-panel.svelte';
  import InternalAssetsPanel from '$lib/components/assets/browser/internal-assets-panel.svelte';
  import LocationSelector from '$lib/components/assets/browser/location-selector.svelte';
  import CreateSubfolderDialog from '$lib/components/assets/list/create-subfolder-dialog.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import {
    getInitialLibraryName,
    getInsertedResources,
    getLocationResources,
    getPickedFolderPublicPaths,
    getStockAssetProviderEntries,
    isFolderOffered,
    sortServicesByName,
  } from '$lib/services/assets/browser/select-assets-dialog.svelte';
  import { assetsLocked } from '$lib/services/assets/folders';
  import { revokeBlobURLIfNeeded } from '$lib/services/assets/info';
  import { isCmsFolderPath } from '$lib/services/assets/reserved';
  import {
    canBrowseSubfolders,
    getRelativePath,
    getSubfolders,
    getTakenNames,
  } from '$lib/services/assets/subfolders';
  import { selectAssetsView, showContentOverlay } from '$lib/services/contents/editor';
  import { checkDuplicates } from '$lib/services/contents/fields/file/duplicates.svelte';
  import { hasSameAsset } from '$lib/services/contents/fields/file/helpers';
  import { createFolderAssetListing } from '$lib/services/contents/fields/file/listing.svelte';
  import { convertFileItemToAsset } from '$lib/services/contents/fields/file/process';
  import { getMediaLibraryOptions } from '$lib/services/integrations/media-libraries';
  import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
  import { allStockAssetProviders } from '$lib/services/integrations/media-libraries/stock';
  import { normalize } from '$lib/services/search/util';
  import { env } from '$lib/services/user/env.svelte';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import { createPath, getDirName, getGitHash } from '$lib/services/utils/file';
  import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';

  /**
   * @import {
   * Asset,
   * AssetFolderInfo,
   * AssetLibraryFolderMap,
   * AssetLibraryFolderMapKey,
   * AssetSubfolder,
   * EntryDraft,
   * InternalLocaleCode,
   * MediaLibraryAssetKind,
   * MediaLibraryService,
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
   * @property {boolean} [selectFolder] Whether to select a folder instead of files, for a File
   * field with the `select_folder` option. Only the repository folders that can be browsed by
   * subfolder are offered, and the directory being browsed is what gets selected.
   * @property {EntryDraft | null | undefined} [draft] Associated entry draft.
   * @property {InternalLocaleCode} [locale] Locale the assets are selected for. With the
   * `multiple_folders` or `multiple_root_folders` i18n structure, each locale’s entry file has a
   * folder of its own, which entry-relative assets are listed from.
   * @property {MediaField} [fieldConfig] Field configuration.
   * @property {AssetLibraryFolderMap} assetLibraryFolderMap Default asset library folder map.
   * @property {[string, MediaLibraryService][]} enabledCloudServiceEntries List of enabled cloud
   * storage services.
   * @property {File[]} [pendingFiles] Files to be uploaded to the cloud service panel when the
   * dialog opens. These are typically files dropped on the file editor when only a cloud service is
   * available.
   * @property {(resources: SelectedResource[]) => void} [onSelect] Custom `Select` event handler
   * that will be called when the dialog is closed with the Insert button.
   * @property {() => void} [onClose] Custom `Close` event handler that will be called whenever the
   * dialog is closed, after `onSelect` if the Insert button was clicked.
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
    selectFolder = false,
    draft = undefined,
    locale = undefined,
    fieldConfig,
    assetLibraryFolderMap,
    enabledCloudServiceEntries,
    onSelect = undefined,
    onClose = undefined,
    pendingFiles = $bindable([]),
    /* eslint-enable prefer-const */
  } = $props();

  const elementIdPrefix = $props.id();

  let enteredURL = $state('');
  let rawSearchTerms = $state('');
  /**
   * Path of the subfolder being browsed below the selected folder, relative to it. Empty at the
   * folder root.
   */
  let subfolderPath = $state('');
  /**
   * Paths of the subfolders selected when a folder is to be picked. Without any, the directory
   * being browsed is what gets picked. A single selection is cleared on going to another directory,
   * while a multiple selection is kept, like the selected assets, so folders can be picked from
   * anywhere.
   * @type {string[]}
   */
  let selectedSubfolderPaths = $state([]);
  let showNewFolderDialog = $state(false);
  /** @type {Asset[]} */
  let droppedAssets = $state([]);
  /** @type {FilePicker | undefined} */
  let filePicker = $state();
  /** @type {SelectedResource[]} */
  let selectedResources = $state([]);
  /** @type {ExternalAssetsPanel | undefined} */
  let externalAssetsPanel = $state();

  /**
   * View of the asset list, given to the view switcher, which is only rendered once it’s set.
   */
  const currentView = /** @type {{ current: SelectAssetsView }} */ (selectAssetsView);

  const title = $derived(
    selectFolder
      ? _('assets_dialog.title.folder')
      : kind === 'image'
        ? _('assets_dialog.title.image')
        : _('assets_dialog.title.file'),
  );
  const searchTerms = $derived(normalize(rawSearchTerms));
  const isDefaultLibraryEnabled = $derived(
    getMediaLibraryOptions({ fieldConfig }) !== false &&
      Object.values(assetLibraryFolderMap).some((entry) => isFolderOffered(entry, selectFolder)),
  );
  /** Whether the URL input is offered. A folder can only be picked from the repository. */
  const showURLInput = $derived(canEnterURL && !selectFolder);
  /** Cloud storage services offered in the dialog. */
  const cloudServiceEntries = $derived(selectFolder ? [] : enabledCloudServiceEntries);
  const enabledStockAssetProviderEntries = $derived(
    getStockAssetProviderEntries({ fieldConfig, selectFolder, isDefaultLibraryEnabled }),
  );
  const enabledExternalServiceEntries = $derived(
    [...cloudServiceEntries, ...enabledStockAssetProviderEntries].sort(sortServicesByName),
  );
  /**
   * Name of the selected location: the first one offered until the user picks another, and again
   * whenever the locations offered change.
   */
  let libraryName = $derived(
    getInitialLibraryName({
      assetLibraryFolderMap,
      isDefaultLibraryEnabled,
      selectFolder,
      // The files are taken over by the location, so their removal doesn’t change it
      hasPendingFiles: untrack(() => !!pendingFiles.length),
      cloudServiceEntries,
      externalServiceEntries: enabledExternalServiceEntries,
    }),
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
  // Existing files are limited to the accepted types, while the files dropped or picked here are
  // only checked once inserted and processed, as a transformation can change their format
  const assetListing = createFolderAssetListing({
    /**
     * Get the entry draft.
     * @returns {EntryDraft | null | undefined} Draft.
     */
    getDraft: () => draft,
    /**
     * Get the selected folder.
     * @returns {AssetFolderInfo | undefined} Folder.
     */
    getFolder: () => selectedFolder,
    /**
     * Get the locale the assets are selected for.
     * @returns {InternalLocaleCode | undefined} Locale.
     */
    getLocale: () => locale,
    /**
     * Get the asset kind.
     * @returns {MediaLibraryAssetKind | undefined} Kind.
     */
    getKind: () => kind,
    /**
     * Get the accepted file types.
     * @returns {string | undefined} Types.
     */
    getAccept: () => accept,
    /**
     * Get whether file names are slugified.
     * @returns {boolean | undefined} Whether to slugify.
     */
    getSlugificationEnabled: () =>
      getDefaultMediaLibraryOptions({ fieldConfig }).config.slugify_filename,
    /**
     * Get the assets created from the files dropped here.
     * @returns {Asset[]} Assets.
     */
    getDroppedAssets: () => droppedAssets,
  });
  const targetFolderPath = $derived(assetListing.targetFolderPath);
  const listedAssets = $derived(assetListing.listedAssets);
  /**
   * Whether the selected folder is browsed by subfolder, like in the Asset Library. A search looks
   * through the whole folder instead, listing the matches with their paths.
   */
  const browsingSubfolders = $derived(
    canBrowseSubfolders(selectedFolder) && targetFolderPath !== undefined && !searchTerms,
  );
  /** Path of the directory being browsed, which is where uploaded files go. */
  const browsedPath = $derived(createPath([targetFolderPath, subfolderPath]));
  /**
   * Whether the directory being browsed is, or is below, a folder the CMS itself is usually served
   * from, such as `admin`, whose files are read-only. Nothing can be uploaded or created there.
   */
  const browsingCmsFolder = $derived(isDefaultLibrary && isCmsFolderPath(browsedPath));
  /**
   * Whether nothing can be uploaded to the directory being browsed: one the CMS is served from, or
   * one in a read-only folder, such as a read-only asset collection offered to every field.
   */
  const uploadDisabled = $derived(browsingCmsFolder || !!selectedFolder?.readonly);
  /**
   * Assets right in the browsed directory. Dropped files go there, even during a search, so only
   * these can be replaced by one.
   */
  const browsedDirAssets = $derived(
    listedAssets.filter(({ path }) => getDirName(path) === browsedPath),
  );
  /** Assets shown in the panel: those right in the browsed directory, or every asset listed. */
  const panelAssets = $derived(browsingSubfolders ? browsedDirAssets : listedAssets);
  const subfolders = $derived(
    browsingSubfolders ? getSubfolders({ dirPath: browsedPath, assets: listedAssets }) : [],
  );
  /**
   * Names already taken in the browsed directory, which a new folder can’t be given, including the
   * names of the folders leading to another asset folder nested in it.
   */
  const takenNames = $derived(
    getTakenNames({
      subfolders,
      fileNames: panelAssets.map(({ name }) => name),
      dirPath: browsingSubfolders ? browsedPath : undefined,
    }),
  );
  /** Label of the selected folder, at the start of the breadcrumb. */
  const selectedFolderLabel = $derived(
    selectedFolder?.label || _(`assets_dialog.folder.${libraryName.replace('default-', '')}`),
  );
  const isEnabledMediaService = $derived(
    enabledStockAssetProviderEntries.some(
      ([serviceId, { authType }]) =>
        serviceId === libraryName && (authType === 'none' || !!prefs.apiKeys?.[libraryName]),
    ),
  );
  const isCloudLibrary = $derived(
    cloudServiceEntries.map(([serviceId]) => serviceId).includes(libraryName),
  );
  const isStockLibrary = $derived(
    enabledStockAssetProviderEntries
      .map(([serviceId]) => serviceId)
      .includes(/** @type {any} */ (libraryName)),
  );
  /**
   * Public paths of the folders to be picked: the selected subfolders, or the directory being
   * browsed. Empty unless a folder is to be picked from a folder that can be browsed.
   */
  const pickedFolderPublicPaths = $derived(
    getPickedFolderPublicPaths({
      selectFolder,
      browsingSubfolders,
      folder: selectedFolder,
      basePath: targetFolderPath,
      subfolderPath,
      selectedSubfolderPaths,
    }),
  );

  /**
   * Select or deselect a subfolder when a folder is to be picked.
   * @param {AssetSubfolder} subfolder Subfolder.
   * @param {boolean} selected Whether the subfolder is now selected.
   */
  const onSelectSubfolder = ({ path }, selected) => {
    const otherPaths = selectedSubfolderPaths.filter((p) => p !== path);

    // The list box reports the folder that loses a single selection after the one that gets it, if
    // it comes later in the list, so only the given folder is removed on deselection
    selectedSubfolderPaths = selected ? [...(multiple ? otherPaths : []), path] : otherPaths;
  };

  /**
   * Go to another directory within the selected folder, clearing a single subfolder selection.
   * @param {string} path Subfolder path relative to the selected folder. Empty for its root.
   */
  const navigate = (path) => {
    subfolderPath = path;

    if (!multiple) {
      selectedSubfolderPaths = [];
    }
  };

  /**
   * Process a dropped file.
   * @param {File} file File to be processed.
   * @param {boolean} replace Whether the file replaces an existing asset with the same name.
   * @returns {Promise<Asset | undefined>} Processed asset or `undefined` if the file already
   * exists.
   */
  const processFile = async (file, replace) => {
    const sha = await getGitHash(file);
    const folder = selectedFolder;

    if (hasSameAsset({ sha, folder, unsavedAssets: assetListing.unsavedAssets })) {
      return undefined;
    }

    const asset = await convertFileItemToAsset({
      file,
      folder,
      targetFolderPath,
      // The file goes to the subfolder being browsed, or the one the search started from
      subfolderPath,
      replace,
    });

    droppedAssets.push(asset);

    return asset;
  };

  /**
   * Handle dropped files.
   * @param {File[]} files File list.
   */
  const onDrop = async (files) => {
    // The files in a read-only folder, or one the CMS itself is served from, can’t be changed. The
    // drop zone and the Upload button are disabled there, so this is only a safeguard
    /* v8 ignore next 3 -- unreachable, as explained above */
    if (uploadDisabled) {
      return;
    }

    const replace = await checkDuplicates({ files, listedAssets: browsedDirAssets });

    if (replace === undefined) {
      // User cancelled the dialog
      return;
    }

    selectedResources = (await Promise.all(files.map((file) => processFile(file, replace))))
      .filter((asset) => !!asset)
      .map((asset) => ({ asset, replace }));
  };

  /**
   * Reset all the values.
   */
  const resetValues = () => {
    enteredURL = '';
    rawSearchTerms = '';
    subfolderPath = '';
    selectedSubfolderPaths = [];
    // The blob URLs of dropped files belong to the dialog, since the field takes the file itself on
    // Insert
    droppedAssets.forEach((asset) => revokeBlobURLIfNeeded(asset.blobURL));
    droppedAssets = [];
    assetListing.reset();
    selectedResources = [];
  };

  /**
   * Handle the OK button click.
   */
  const onOk = () => {
    if (selectFolder) {
      /* v8 ignore next 3 -- the Select button is disabled until a folder is browsed */
      if (!pickedFolderPublicPaths.length) {
        return;
      }

      onSelect?.(pickedFolderPublicPaths.map((folderPath) => ({ folderPath })));

      return;
    }

    /* v8 ignore next 3 -- the Insert button is disabled until something is selected */
    if (!selectedResources.length) {
      return;
    }

    // A stock asset service may need to know which of its assets have been used
    externalAssetsPanel?.trackDownloads();
    onSelect?.(getInsertedResources({ resources: selectedResources, targetFolderPath }));
  };

  $effect(() => {
    if (!showContentOverlay.current) {
      open = false;
    }
  });

  // Upload pending files (e.g. dropped on the file editor) to the cloud service panel once mounted
  $effect(() => {
    if (externalAssetsPanel && isCloudLibrary && pendingFiles.length) {
      externalAssetsPanel.uploadFiles(pendingFiles);
      pendingFiles = [];
    }
  });
</script>

{#snippet newFolderButton(/** @type {() => void} */ onclick, disabled = false)}
  <Button variant="ghost" iconic {disabled} aria-label={_('new_folder')} {onclick}>
    {#snippet startIcon()}
      <Icon name="create_new_folder" />
    {/snippet}
  </Button>
{/snippet}

{#snippet headerItems()}
  {#if isDefaultLibrary || (isCloudLibrary && libraryName !== 'cloudinary') || (isStockLibrary && libraryName !== 'picsum')}
    {#if selectAssetsView.current}
      <ViewSwitcher {currentView} aria-controls="select-assets-grid" />
    {/if}
    <!-- A search lists matching files rather than folders, so it’s not offered for a folder -->
    {#if !selectFolder}
      <SearchBar
        dir="auto"
        flex={env.isSmallScreen}
        bind:value={rawSearchTerms}
        debounce={!isDefaultLibrary}
        disabled={selectedResources.some((r) => r.file)}
        ariaLabel={_(`assets_dialog.search_for_${kind ?? 'file'}`)}
      />
    {/if}
  {/if}
  {#if browsingSubfolders}
    <!--
      Creating a folder commits straight to the configured branch rather than going through
      review, so it’s not something an Open Authoring contributor or a user who can’t push to the
      branch can do, nor anyone within a read-only folder
    -->
    {@render newFolderButton(() => {
      showNewFolderDialog = true;
    }, assetsLocked.current || uploadDisabled)}
  {:else if isCloudLibrary && externalAssetsPanel?.canCreateFolder()}
    <!-- A folder on a cloud storage service is created by the service, not committed -->
    {@render newFolderButton(() => {
      externalAssetsPanel?.showNewFolderDialog();
    })}
  {/if}
  {#if !selectFolder && (isDefaultLibrary || (isCloudLibrary && libraryName !== 'cloudinary'))}
    <Button
      variant="primary"
      label={_('upload')}
      disabled={uploadDisabled}
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
  okLabel={selectFolder ? _('select') : _('insert')}
  okDisabled={selectFolder ? !pickedFolderPublicPaths.length : !selectedResources.length}
  focusInput={false}
  bind:open
  {onOk}
  onClose={() => {
    resetValues();
    onClose?.();
  }}
>
  {#snippet headerExtra()}
    {#if !env.isSmallScreen}
      {@render headerItems()}
    {/if}
  {/snippet}
  {#snippet footerExtra()}
    {#if pickedFolderPublicPaths.length}
      <div role="status" class="selected-folder" dir="auto">
        {#if pickedFolderPublicPaths.length === 1}
          {_('assets_dialog.selected_folder', { values: { path: pickedFolderPublicPaths[0] } })}
        {:else}
          {_('assets_dialog.selected_folders', {
            values: { count: pickedFolderPublicPaths.length },
          })}
        {/if}
      </div>
    {/if}
    {#if isEnabledMediaService}
      {@const { showServiceLink, serviceLabel, serviceURL } =
        allStockAssetProviders[/** @type {StockAssetProviderName} */ (libraryName)]}
      {#if showServiceLink}
        <a href={serviceURL} class="service-link">
          {_('prefs.media.stock_photos.credit', { values: { service: serviceLabel } })}
        </a>
      {/if}
    {/if}
  {/snippet}
  <div role="none" class="wrapper">
    <div role="none" class="nav">
      <LocationSelector
        {libraryName}
        {assetLibraryFolderMap}
        showRepository={isDefaultLibraryEnabled}
        {selectFolder}
        {cloudServiceEntries}
        {showURLInput}
        stockAssetProviderEntries={enabledStockAssetProviderEntries}
        controlsId="{elementIdPrefix}-content-pane"
        onChange={(name) => {
          libraryName = name;
          subfolderPath = '';
          selectedSubfolderPaths = [];
          // The URL entered earlier is still in the text box, so it’s selected again
          selectedResources = getLocationResources({ libraryName, enteredURL });
        }}
      />
      {#if env.isSmallScreen}
        <div role="none" class="filter-tools">
          {@render headerItems()}
        </div>
      {/if}
    </div>
    <!-- The focus is kept here while the folders being browsed are replaced -->
    <div role="none" id="{elementIdPrefix}-content-pane" class="content-pane" data-focus-scope>
      {#if isDefaultLibrary && selectedFolder}
        <InternalAssetsPanel
          {accept}
          {multiple}
          {kind}
          {selectFolder}
          {uploadDisabled}
          assets={selectFolder ? [] : panelAssets}
          bind:selectedResources
          {searchTerms}
          basePath={browsingSubfolders ? browsedPath : selectedFolder.internalPath}
          folderLabel={selectedFolderLabel}
          subfolderPath={browsingSubfolders ? subfolderPath : ''}
          {subfolders}
          onDrop={({ files }) => {
            onDrop(files);
          }}
          {selectedSubfolderPaths}
          onSelectSubfolder={selectFolder ? onSelectSubfolder : undefined}
          onNavigate={navigate}
          onOpenSubfolder={({ path }) => {
            navigate(getRelativePath(path, /** @type {string} */ (targetFolderPath)));
          }}
        />
      {/if}
      {#if showURLInput && libraryName === 'enter-url'}
        <EmptyState>
          <div role="none">
            {kind === 'image'
              ? _('assets_dialog.enter_image_url')
              : _('assets_dialog.enter_file_url')}
          </div>
          <TextInput
            dir="ltr"
            bind:value={enteredURL}
            flex
            oninput={() => {
              selectedResources = getLocationResources({ libraryName, enteredURL });
            }}
          />
        </EmptyState>
      {/if}
      {#each enabledExternalServiceEntries as [serviceId, serviceProps] (serviceId)}
        {#if serviceId === 'cloudinary'}
          <CloudinaryPanel
            {kind}
            {fieldConfig}
            {multiple}
            hidden={libraryName !== 'cloudinary'}
            onSelect={(resources) => {
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

{#if browsingSubfolders}
  <CreateSubfolderDialog bind:open={showNewFolderDialog} dirPath={browsedPath} {takenNames} />
{/if}

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

<style>
  .wrapper {
    display: flex;
    gap: 16px;
    height: 60dvh;
    max-height: 800px;
    --tile-padding: 4px;

    @media (width < 768px) {
      flex-direction: column;
      overflow: hidden;
      height: 72dvh;
    }

    .nav {
      flex: none;
      display: flex;
      gap: 4px;

      @media (width < 768px) {
        flex-direction: column;
      }
    }

    :global {
      .listbox {
        flex: none;
        background-color: transparent;

        .option button .icon:not(.check) {
          display: block;
        }
      }
    }

    .content-pane {
      overflow: auto;
      flex: auto;
    }
  }

  .service-link,
  .selected-folder {
    font-size: var(--sui-font-size-small);
  }

  .selected-folder {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .filter-tools {
    display: flex;
    gap: 8px;
  }
</style>
