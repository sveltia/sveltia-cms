<!--
  @component
  Implement a panel that allows searching media files from an external media library and selecting
  one for an image/file entry field.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, EmptyState, InfiniteScroll, Toast } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { onMount } from 'svelte';

  import AssetPath from '$lib/components/assets/browser/asset-path.svelte';
  import SimpleImageGridItem from '$lib/components/assets/browser/simple-image-grid-item.svelte';
  import SimpleImageGrid from '$lib/components/assets/browser/simple-image-grid.svelte';
  import SubfolderStrip from '$lib/components/assets/browser/subfolder-strip.svelte';
  import SubfolderNameDialog from '$lib/components/assets/list/subfolder-name-dialog.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import CloudServiceAuth from '$lib/components/assets/shared/cloud-service-auth.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import RejectedFilesAlertDialog from '$lib/components/assets/shared/rejected-files-alert-dialog.svelte';
  import Breadcrumb from '$lib/components/common/breadcrumb.svelte';
  import { getFetchOptions } from '$lib/services/assets/external';
  import { fetchExternalAssetBlob } from '$lib/services/assets/external/data';
  import { partitionProcessedFiles, processFile } from '$lib/services/assets/process';
  import { getDirName, getRelativePath, listSubfolders } from '$lib/services/assets/subfolders';
  import { cmsConfig } from '$lib/services/config';
  import { selectAssetsView } from '$lib/services/contents/editor';
  import { env } from '$lib/services/user/env.svelte';
  import { watch } from '$lib/services/utils/state.svelte';

  /**
   * @import {
   * ExternalAsset,
   * MediaLibraryAssetKind,
   * MediaLibraryFetchOptions,
   * MediaLibraryService,
   * SelectedResource,
   * } from '$lib/types/private';
   * @import { MediaField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MediaField} [fieldConfig] File/Image field configuration.
   * @property {MediaLibraryAssetKind} [kind] Asset kind.
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {string} [searchTerms] Search terms for filtering assets.
   * @property {MediaLibraryService} serviceProps Media library service details.
   * @property {string} [gridId] The `id` attribute of the inner listbox.
   * @property {SelectedResource[]} selectedResources Selected resources.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    kind,
    fieldConfig = undefined,
    multiple = false,
    searchTerms = '',
    serviceProps,
    gridId = undefined,
    selectedResources = $bindable([]),
    /* eslint-enable prefer-const */
  } = $props();

  const {
    serviceType = 'stock_assets',
    serviceId = '',
    serviceLabel = '',
    hotlinking = false,
    authType = 'api_key',
    init,
    list,
    browse,
    search,
    upload,
    createFolder,
  } = $derived(serviceProps);

  // Use the grid view for Picsum as it doesn’t provide description for the assets, and the list
  // view relies on the description to show asset information.
  const viewType = $derived(serviceId === 'picsum' ? 'grid' : selectAssetsView.current?.type);
  const isStockAssets = $derived(serviceType === 'stock_assets');
  const allMediaLibraryOptions = $derived(
    fieldConfig?.media_libraries?.all ?? cmsConfig.current?.media_libraries?.all ?? {},
  );
  /* v8 ignore start -- only read to report a file exceeding the configured size */
  const maxSize = $derived(
    /** @type {number} */ (allMediaLibraryOptions.max_file_size ?? Infinity),
  );
  /* v8 ignore stop */

  let hasConfig = $state(true);
  let hasAuthInfo = $state(false);
  let apiKey = $state('');
  let userName = $state('');
  let password = $state('');
  /** @type {ExternalAsset[] | null} */
  let listedAssets = $state(null);
  /**
   * Paths of the empty folders on a service with folder support, each kept by a placeholder.
   * @type {string[]}
   */
  let folders = $state([]);
  /**
   * Path of the folder being browsed on a service with folder support, relative to the configured
   * prefix. Empty at the root.
   */
  let dirPath = $state('');
  let newFolderDialogOpen = $state(false);
  let folderCreationFailed = $state(false);
  /** @type {string | undefined} */
  let error = $state();
  /** @type {{ show: boolean, status: 'info' | 'error', length: number }} */
  let uploadingToast = $state({ show: false, status: 'info', length: 0 });
  /** @type {string[]} */
  let oversizedFileNames = $state([]);
  /** @type {string[]} */
  let invalidFileNames = $state([]);
  let showRejectedFilesAlert = $state(false);

  /** @type {MediaLibraryFetchOptions} */
  const listFetchOptions = $derived({ kind, fieldConfig, apiKey, userName, password });
  /**
   * Whether the service is browsed folder by folder, like a repository folder in the picker. A
   * search looks through the whole service instead, listing the matches with their paths.
   */
  const browsing = $derived(!!browse && !searchTerms.trim());
  /**
   * Assets shown in the panel: those right in the folder being browsed, or every asset listed.
   * @type {ExternalAsset[]}
   */
  const panelAssets = $derived.by(() => {
    const assets = listedAssets ?? [];

    return browsing
      ? assets.filter(({ description }) => getDirName(description) === dirPath)
      : assets;
  });
  const subfolders = $derived(
    browsing
      ? listSubfolders({
          dirPath,
          paths: [
            ...(listedAssets ?? []).map(({ description }) => description),
            // An empty folder is given with a trailing slash, as it has no file to be read off
            ...folders.map((path) => `${path}/`),
          ],
        })
      : [],
  );
  /** Names of the folders leading to the one being browsed, from the service root down. */
  const subfolderNames = $derived(dirPath ? dirPath.split('/') : []);
  /** Names already taken in the folder being browsed, which a new folder can’t be given. */
  const takenNames = $derived([
    ...subfolders.map(({ name }) => name),
    ...panelAssets.map(({ fileName }) => fileName),
  ]);
  /** The folder being browsed, named after the service at the root. */
  const folderLabel = $derived(dirPath ? `/${dirPath}` : serviceLabel);

  /**
   * Search or list assets from the external media library.
   * @param {string} [query] Search query.
   */
  const getAssets = async (query = '') => {
    listedAssets = null;
    query = query.trim();

    try {
      if (query) {
        listedAssets = (await search?.(query, listFetchOptions)) ?? [];
      } else if (browse) {
        // A service with folder support lists its empty folders along with the files
        const listing = await browse(listFetchOptions);

        listedAssets = listing.assets;
        folders = listing.folders;
      } else {
        listedAssets = (await list?.(listFetchOptions)) ?? [];
      }
    } catch (ex) {
      error = 'search_fetch_failed';
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  };

  /**
   * Download the selected asset, if needed, and return the file and credit. If hotlinking is
   * required by the service, just return the URL instead of downloading the file.
   * @param {ExternalAsset} asset Selected asset.
   * @returns {Promise<SelectedResource | undefined>} The selected resource with the file or URL.
   * @todo Support video files.
   */
  const getResource = async (asset) => {
    const { downloadURL: url, fileName, credit } = asset;

    if (hotlinking) {
      return { url, credit };
    }

    try {
      const blob = await fetchExternalAssetBlob(asset);

      return { url, credit, file: new File([blob], fileName, { type: blob.type }) };
    } catch (ex) {
      error = 'image_fetch_failed';
      // eslint-disable-next-line no-console
      console.error(ex);
    }

    return undefined;
  };

  /**
   * Handle `Drop` event to upload files.
   * @param {File[]} files Dropped files.
   */
  export const uploadFiles = async (files) => {
    if (!upload) {
      return;
    }

    const processed = await Promise.all(files.map((f) => processFile(f, allMediaLibraryOptions)));
    const { validFiles, oversizedFiles, invalidFiles } = partitionProcessedFiles(processed);

    files = validFiles;
    oversizedFileNames = oversizedFiles.map(({ name }) => name);
    invalidFileNames = invalidFiles.map(({ name }) => name);

    if (oversizedFileNames.length || invalidFileNames.length) {
      showRejectedFilesAlert = true;
    }

    if (!files.length) {
      return;
    }

    uploadingToast = { show: true, status: 'info', length: files.length };

    try {
      // The files go to the folder being browsed, or the one the search started from
      const uploaded = await upload(files, { ...listFetchOptions, dirPath });
      const resources = await Promise.all(uploaded.map((asset) => getResource(asset)));

      selectedResources = resources.filter((r) => !!r).slice(0, multiple ? undefined : 1);
      listedAssets = [...uploaded, ...(listedAssets ?? [])];
    } catch {
      uploadingToast = { show: true, status: 'error', length: files.length };
    }
  };

  /**
   * Whether a folder can be created in the folder being browsed, which takes a service with folder
   * support that can create one, while it’s browsed rather than searched.
   * @returns {boolean} Result.
   */
  export const canCreateFolder = () => browsing && !!createFolder;

  /**
   * Open the New Folder dialog.
   */
  export const showNewFolderDialog = () => {
    newFolderDialogOpen = true;
  };

  /**
   * Create a folder in the folder being browsed, which is then listed along with the others.
   * @param {string} name Folder name.
   */
  const createNewFolder = async (name) => {
    const path = dirPath ? `${dirPath}/${name}` : name;

    try {
      await /** @type {NonNullable<typeof createFolder>} */ (createFolder)(path, listFetchOptions);
      folders = [...folders, path];
    } catch (ex) {
      folderCreationFailed = true;
      // eslint-disable-next-line no-console
      console.error(ex);
    }
  };

  /**
   * Check if the given asset is already selected.
   * @param {ExternalAsset} asset The asset to check.
   * @returns {boolean} `true` if the asset is selected, `false` otherwise.
   */
  const isSelected = (asset) => selectedResources.some((r) => r.url === asset.downloadURL);

  /**
   * Handle selection change of an asset.
   * @param {ExternalAsset} asset The asset whose selection changed.
   * @param {boolean} selected `true` if the asset is now selected, `false` otherwise.
   */
  const onSelectionChange = async (asset, selected) => {
    const otherResources = selectedResources.filter((r) => r.url !== asset.downloadURL);

    if (selected) {
      const resource = await getResource(asset);

      if (resource) {
        selectedResources = [...otherResources, resource];
      }
    } else {
      selectedResources = otherResources;
    }
  };

  /**
   * Load the stored credentials. Fetching the assets is left to the effect below, which reacts to
   * `hasAuthInfo` being set.
   */
  const loadAuthInfo = () => {
    const options = getFetchOptions(serviceProps);

    apiKey = options.apiKey;
    userName = options.userName;
    password = options.password;
    hasAuthInfo = authType === 'none' || !!apiKey || !!password;
  };

  onMount(() => {
    (async () => {
      if (typeof init === 'function') {
        hasConfig = false;
        hasConfig = await init();
      }

      if (!hasConfig) {
        return;
      }

      loadAuthInfo();
      listedAssets = null;
    })();
  });

  watch(
    () => [searchTerms, hasAuthInfo],
    () => {
      if (hasAuthInfo) {
        getAssets(searchTerms);
      }
    },
  );
</script>

{#snippet breadcrumb()}
  {#if browsing && subfolderNames.length}
    <!-- Each ancestor leads back to itself, like the breadcrumb of the Asset Library -->
    <Breadcrumb
      class="picker-breadcrumb"
      items={[
        ...[serviceLabel, ...subfolderNames.slice(0, -1)].map((label, depth) => ({
          label,
          // eslint-disable-next-line jsdoc/require-jsdoc
          onClick: () => {
            dirPath = subfolderNames.slice(0, depth).join('/');
          },
        })),
        { label: /** @type {string} */ (subfolderNames.at(-1)) },
      ]}
    />
  {/if}
{/snippet}

{#snippet content()}
  {#if !listedAssets}
    <EmptyState>
      <span role="alert">{_(searchTerms ? 'searching' : 'loading')}</span>
    </EmptyState>
  {:else if !panelAssets.length && !subfolders.length}
    {@render breadcrumb()}
    <EmptyState>
      <span role="alert">{_('no_files_found')}</span>
    </EmptyState>
  {:else}
    {@render breadcrumb()}
    <div role="none" class="grid-wrapper">
      {#if subfolders.length}
        <SubfolderStrip
          {subfolders}
          {viewType}
          onOpen={({ path }) => {
            dirPath = path;
          }}
        />
      {/if}
      <SimpleImageGrid {viewType} {gridId} {multiple}>
        <InfiniteScroll items={panelAssets} itemKey="id">
          {#snippet renderItem(/** @type {ExternalAsset} */ asset)}
            {#await sleep() then}
              {@const { id, previewURL, description, kind: _kind } = asset}
              <SimpleImageGridItem
                value={id}
                ariaLabel={description}
                {viewType}
                {multiple}
                selected={isSelected(asset)}
                onChange={({ detail: { selected } }) => {
                  onSelectionChange(asset, selected);
                }}
              >
                <AssetPreview
                  kind={_kind}
                  src={previewURL}
                  alt={description}
                  variant="tile"
                  crossorigin="anonymous"
                />
                {#if viewType === 'list' || (!env.isSmallScreen && !isStockAssets)}
                  <!-- The path is relative to the folder being browsed -->
                  <AssetPath
                    {...isStockAssets
                      ? { caption: description }
                      : { path: browsing ? getRelativePath(description, dirPath) : description }}
                  />
                {/if}
              </SimpleImageGridItem>
            {/await}
          {/snippet}
        </InfiniteScroll>
      </SimpleImageGrid>
    </div>
  {/if}
{/snippet}

{#if hasAuthInfo}
  {#if error}
    <EmptyState>
      <span role="alert">{_(`assets_dialog.error.${error}`)}</span>
    </EmptyState>
  {:else if upload}
    <DropZone accept={fieldConfig?.accept} multiple onDrop={({ files }) => uploadFiles(files)}>
      {@render content()}
    </DropZone>
  {:else}
    {@render content()}
  {/if}
{:else if hasConfig}
  <CloudServiceAuth {serviceProps} onAuth={loadAuthInfo} />
{:else}
  <EmptyState>
    <span role="alert">{_('cloud_storage.invalid')}</span>
  </EmptyState>
{/if}

<Toast bind:show={uploadingToast.show}>
  <Alert status={uploadingToast.status}>
    {#if uploadingToast.status === 'info'}
      {_('uploading_files_progress')}
    {/if}
    {#if uploadingToast.status === 'error'}
      {_('uploading_files_failed')}
    {/if}
  </Alert>
</Toast>

<RejectedFilesAlertDialog
  bind:open={showRejectedFilesAlert}
  {oversizedFileNames}
  {invalidFileNames}
  {maxSize}
/>

<Toast bind:show={folderCreationFailed}>
  <Alert status="error">{_('creating_folder_failed')}</Alert>
</Toast>

{#if createFolder}
  <SubfolderNameDialog
    bind:open={newFolderDialogOpen}
    title={_('new_folder')}
    okLabel={_('new_folder_create')}
    description={_('new_folder_description', { values: { folder: folderLabel } })}
    {takenNames}
    onSubmit={(name) => {
      createNewFolder(name);
    }}
  />
{/if}

<style>
  :global(.picker-breadcrumb) {
    flex: none;
    padding: 0 8px 8px;

    :global(.current) {
      font-weight: var(--sui-font-weight-bold);
    }
  }

  .grid-wrapper {
    overflow-y: auto;
    height: 100%;
  }
</style>
