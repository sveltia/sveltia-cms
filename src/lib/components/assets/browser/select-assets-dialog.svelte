<script>
  import { _ } from '@sveltia/i18n';
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
  import { untrack } from 'svelte';

  import CloudinaryPanel from '$lib/components/assets/browser/cloudinary-panel.svelte';
  import ExternalAssetsPanel from '$lib/components/assets/browser/external-assets-panel.svelte';
  import InternalAssetsPanel from '$lib/components/assets/browser/internal-assets-panel.svelte';
  import CreateSubfolderDialog from '$lib/components/assets/list/create-subfolder-dialog.svelte';
  import ViewSwitcher from '$lib/components/common/page-toolbar/view-switcher.svelte';
  import {
    getFirstDefaultLibraryName,
    getInsertedResources,
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
    getDirName,
    getRelativePath,
    getSubfolders,
    getTakenNames,
  } from '$lib/services/assets/subfolders';
  import { selectAssetsView, showContentOverlay } from '$lib/services/contents/editor';
  import { checkDuplicates } from '$lib/services/contents/fields/file/duplicates.svelte';
  import {
    getTargetFolderPath,
    hasSameAsset,
    listAssets,
  } from '$lib/services/contents/fields/file/helpers';
  import {
    convertFileItemToAsset,
    getUnsavedAssets,
  } from '$lib/services/contents/fields/file/process';
  import { getMediaLibraryOptions } from '$lib/services/integrations/media-libraries';
  import {
    activated as cloudinaryActivated,
    dialogOpen as cloudinaryDialogOpen,
  } from '$lib/services/integrations/media-libraries/cloud/cloudinary';
  import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
  import { allStockAssetProviders } from '$lib/services/integrations/media-libraries/stock';
  import { normalize } from '$lib/services/search/util';
  import { env } from '$lib/services/user/env.svelte';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import { createPath, getGitHash } from '$lib/services/utils/file';
  import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';
  import { watchAsync } from '$lib/services/utils/state.svelte';

  /**
   * @import {
   * Asset,
   * AssetLibraryFolderMap,
   * AssetLibraryFolderMapKey,
   * AssetSubfolder,
   * EntryDraft,
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
  let libraryName = $state('default-global');
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
  /** @type {Asset[]} */
  let unsavedAssets = $state([]);
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
  const isDefaultLibrary = $derived(libraryName.startsWith('default-'));
  const selectedFolder = $derived.by(() => {
    if (!isDefaultLibrary) {
      return undefined;
    }

    const key = /** @type {AssetLibraryFolderMapKey} */ (libraryName.replace('default-', ''));
    const { folder } = assetLibraryFolderMap[key];

    return folder;
  });
  const targetFolderPath = $derived(
    getTargetFolderPath({ entry: draft?.originalEntry, folder: selectedFolder }),
  );
  const slugificationEnabled = $derived(
    getDefaultMediaLibraryOptions({ fieldConfig }).config.slugify_filename,
  );
  const listedAssets = $derived(
    listAssets({
      kind,
      folder: selectedFolder,
      folderPath: targetFolderPath,
      unsavedAssets,
      slugificationEnabled,
    }),
  );
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
  /** Names already taken in the browsed directory, which a new folder can’t be given. */
  const takenNames = $derived(
    getTakenNames({ subfolders, fileNames: panelAssets.map(({ name }) => name) }),
  );
  /** Label of the selected folder, at the start of the breadcrumb. */
  const selectedFolderLabel = $derived(
    selectedFolder?.label || _(`assets_dialog.folder.${libraryName.replace('default-', '')}`),
  );
  const enabledStockAssetProviderEntries = $derived(
    getStockAssetProviderEntries({ fieldConfig, selectFolder, isDefaultLibraryEnabled }),
  );
  const isEnabledMediaService = $derived(
    enabledStockAssetProviderEntries.some(
      ([serviceId, { authType }]) =>
        serviceId === libraryName && (authType === 'none' || !!prefs.apiKeys?.[libraryName]),
    ),
  );
  const enabledExternalServiceEntries = $derived(
    [...cloudServiceEntries, ...enabledStockAssetProviderEntries].sort(sortServicesByName),
  );
  const isCloudLibrary = $derived(
    cloudServiceEntries.map(([serviceId]) => serviceId).includes(libraryName),
  );
  const isStockLibrary = $derived(
    enabledStockAssetProviderEntries
      .map(([serviceId]) => serviceId)
      .includes(/** @type {any} */ (libraryName)),
  );
  const Selector = $derived(env.isSmallScreen ? Select : Listbox);
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

    if (hasSameAsset({ sha, folder, unsavedAssets })) {
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
    // The files in a folder the CMS itself is served from are read-only
    if (browsingCmsFolder) {
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
    unsavedAssets = [];
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

    onSelect?.(getInsertedResources({ resources: selectedResources, targetFolderPath }));
  };

  $effect.pre(() => {
    const firstDefaultLibraryName = getFirstDefaultLibraryName({
      assetLibraryFolderMap,
      isDefaultLibraryEnabled,
      selectFolder,
    });

    if (firstDefaultLibraryName) {
      // Select the first enabled folder
      libraryName = firstDefaultLibraryName;
    } else if (untrack(() => pendingFiles.length)) {
      // Select the first cloud storage service, which can take the files to be uploaded
      libraryName = cloudServiceEntries[0]?.[0] ?? enabledExternalServiceEntries[0]?.[0];
    } else {
      // Select the first available external service, if any. There can be none when a folder is
      // to be selected but the field has no folder that can be browsed
      libraryName = enabledExternalServiceEntries[0]?.[0] ?? '';
    }
  });

  // A read started for an earlier state of the draft can be answered after a later one, which
  // `watchAsync` takes care of
  watchAsync(
    async () => {
      // Somehow we need to snapshot `droppedAssets` here to make Svelte aware of its changes
      void $state.snapshot(droppedAssets);

      return [
        // The draft’s files are read synchronously, so their changes are tracked as well
        ...(draft?.files ? await getUnsavedAssets({ draft, targetFolderPath }) : []),
        ...Object.values(droppedAssets),
      ];
    },
    (assets) => {
      unsavedAssets = assets;
    },
  );

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
    {@render newFolderButton(
      () => {
        showNewFolderDialog = true;
      },
      assetsLocked.current || !!selectedFolder?.readonly || browsingCmsFolder,
    )}
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
      disabled={browsingCmsFolder}
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
      <Selector
        class="tabs"
        ariaLabel={_('assets_dialog.locations')}
        aria-controls="{elementIdPrefix}-content-pane"
        filterThreshold={-1}
        onChange={(event) => {
          libraryName = event.detail.name;
          subfolderPath = '';
          selectedSubfolderPaths = [];
          selectedResources = [];
        }}
      >
        {#if isDefaultLibraryEnabled}
          <OptionGroup label={_('asset_location.repository')}>
            {#each Object.entries(assetLibraryFolderMap) as [id, entry] (id)}
              {#if isFolderOffered(entry, selectFolder)}
                {@const { folder } = entry}
                {@const name = `default-${id}`}
                <Option
                  {name}
                  label={folder?.label || _(`assets_dialog.folder.${id}`)}
                  selected={libraryName === name}
                >
                  {#snippet startIcon()}
                    <Icon name="folder" />
                  {/snippet}
                </Option>
              {/if}
            {/each}
          </OptionGroup>
        {/if}
        {#if showURLInput || !!cloudServiceEntries.length}
          <OptionGroup label={_('asset_location.external')}>
            {#each cloudServiceEntries as [, { serviceId, serviceLabel }] (serviceId)}
              <Option
                name={serviceId}
                label={serviceLabel}
                selected={libraryName === serviceId}
                onclick={() => {
                  if (serviceId === 'cloudinary' && cloudinaryActivated.current) {
                    cloudinaryDialogOpen.current = true;
                  }
                }}
              >
                {#snippet startIcon()}
                  <Icon name="cloud" />
                {/snippet}
              </Option>
            {/each}
            {#if showURLInput}
              <Option
                name="enter-url"
                label={_('assets_dialog.enter_url')}
                selected={libraryName === 'enter-url'}
              >
                {#snippet startIcon()}
                  <Icon name="link_2" />
                {/snippet}
              </Option>
            {/if}
          </OptionGroup>
        {/if}
        {#if enabledStockAssetProviderEntries.length}
          <OptionGroup label={_('asset_location.stock_photos')}>
            {#each enabledStockAssetProviderEntries as [serviceId, { serviceLabel }] (serviceId)}
              <Option name={serviceId} label={serviceLabel} selected={libraryName === serviceId}>
                {#snippet startIcon()}
                  <Icon name="photo_camera_back" />
                {/snippet}
              </Option>
            {/each}
          </OptionGroup>
        {/if}
      </Selector>
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
              const url = enteredURL.trim();

              selectedResources = url ? [{ url }] : [];
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
