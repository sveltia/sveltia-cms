<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Divider, Icon, Listbox, Option, OptionGroup } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import equal from 'fast-deep-equal';

  import QuickSearchBar from '$lib/components/global/toolbar/items/quick-search-bar.svelte';
  import { appNumberFormatter } from '$lib/services/app/i18n';
  import { goto } from '$lib/services/app/navigation';
  import { countAssetsInFolder } from '$lib/services/assets';
  import { createAssetDropTarget } from '$lib/services/assets/drag';
  import {
    enabledCloudServices,
    externalAssetCounts,
    getCloudServicePath,
    selectedCloudService,
  } from '$lib/services/assets/external';
  import { linkedAssets, linkedFilesService } from '$lib/services/assets/external/linked';
  import { getAssetFolderKey, selectedAssetFolder } from '$lib/services/assets/folders';
  import { allAssets } from '$lib/services/assets/state';
  import { selectedSubfolderPath } from '$lib/services/assets/subfolders';
  import { getFolderLabelByCollection } from '$lib/services/assets/view';
  import { getAssetFolderIcon, getListedAssetFolders } from '$lib/services/assets/view/folder-list';
  import { env } from '$lib/services/user/env.svelte';
  import { encodePathSegments } from '$lib/services/utils/url';

  /**
   * @import { AssetFolderInfo } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [isSearchPage] Whether the current page is the search results page.
   */

  /** @type {Props} */
  let { isSearchPage = false } = $props();

  /* v8 ignore start -- the app locale is loaded before the sidebar is rendered */
  /**
   * Get the label of a folder, which follows the app locale.
   * @param {AssetFolderInfo} folder Folder.
   * @returns {string} Label.
   */
  const getFolderLabel = (folder) => (appLocale.current ? getFolderLabelByCollection(folder) : '');
  /* v8 ignore stop */

  // All Assets, Global Assets, then collection-level, file-level folders and asset collections,
  // sorted by appearance order in the config
  const folders = $derived(getListedAssetFolders());

  /**
   * Whether to show a divider after the folder at the given index.
   * @param {number} index Index of the folder to check.
   * @returns {boolean} Whether to show a divider after the folder at the given index.
   */
  const shouldShowDivider = (index) =>
    (folders[index].collectionName === undefined &&
      folders[index + 1]?.collectionName !== undefined) ||
    (!folders[index].isAssetCollection && !!folders[index + 1]?.isAssetCollection);
</script>

<nav class="primary-sidebar" aria-label={_('assets')}>
  {#if env.isSmallScreen}
    <header>
      <h2>{_('assets')}</h2>
    </header>
    <QuickSearchBar
      onclick={(event) => {
        event.preventDefault();
        goto('/search');
      }}
    />
  {/if}
  <Listbox
    ariaLabel={_('asset_folder_list')}
    aria-controls={isSearchPage || env.isSmallScreen ? undefined : 'assets-container'}
  >
    {#if folders.length}
      <OptionGroup label={_('asset_location.repository')}>
        {#each folders as folder, index (getAssetFolderKey(folder))}
          {#await sleep() then}
            {@const { internalPath } = folder}
            {@const selected = equal(selectedAssetFolder.current, folder)}
            <Option
              selected={env.isSmallScreen || isSearchPage ? false : selected}
              label={getFolderLabel(folder)}
              onSelect={() => {
                goto(encodePathSegments(`/assets/${internalPath ?? '-/all'}`), {
                  transitionType: 'forwards',
                  // An internal path can be shared by multiple collections, files and fields. Pass
                  // the folder info as history state so we can distinguish these different asset
                  // folders while keeping the URL clean.
                  state: { folder },
                });
              }}
              onclick={() => {
                // Selecting the folder already selected doesn’t fire `onSelect` again, but a click
                // on it while one of its subfolders is browsed should still lead back to its root
                if (selected && selectedSubfolderPath.current) {
                  goto(encodePathSegments(`/assets/${internalPath}`), {
                    transitionType: 'backwards',
                    state: { folder },
                  });
                }
              }}
              {@attach internalPath !== undefined &&
                createAssetDropTarget({ folder, dirPath: internalPath })}
            >
              {#snippet startIcon()}
                <Icon name={getAssetFolderIcon(folder)} />
              {/snippet}
              {#snippet endIcon()}
                {#key allAssets.current}
                  {#await sleep() then}
                    {@const count =
                      internalPath !== undefined
                        ? countAssetsInFolder(folder)
                        : allAssets.current.length}
                    <span class="count" aria-label="({_('x_assets', { values: { count } })})">
                      {appNumberFormatter.current.format(count)}
                    </span>
                  {/await}
                {/key}
              {/snippet}
            </Option>
          {/await}
          {#if shouldShowDivider(index)}
            <Divider />
          {/if}
        {/each}
      </OptionGroup>
    {/if}
    <!-- Hide the group if there is nothing to show: no external location and no linked file -->
    {#if enabledCloudServices.current.length || linkedAssets.current.length}
      <OptionGroup label={_('asset_location.external')}>
        {#each enabledCloudServices.current as service (service.serviceId)}
          {@const { serviceId, serviceLabel } = service}
          <!-- The count is known once the service has been listed; Cloudinary is never listed -->
          {@const count = externalAssetCounts.current[serviceId]}
          <Option
            selected={env.isSmallScreen || isSearchPage
              ? false
              : selectedCloudService.current?.serviceId === serviceId}
            label={serviceLabel}
            onSelect={() => {
              goto(getCloudServicePath(service), { transitionType: 'forwards' });
            }}
            {@attach createAssetDropTarget({ service, dirPath: '' })}
          >
            {#snippet startIcon()}
              <Icon name="cloud" />
            {/snippet}
            {#snippet endIcon()}
              {#if count !== undefined}
                <span class="count" aria-label="({_('x_assets', { values: { count } })})">
                  {appNumberFormatter.current.format(count)}
                </span>
              {/if}
            {/snippet}
          </Option>
        {/each}
        <!-- Files linked from entries by URL, which can be browsed but not managed -->
        {@const linkedCount = linkedAssets.current.length}
        <Option
          selected={env.isSmallScreen || isSearchPage
            ? false
            : selectedCloudService.current?.serviceId === linkedFilesService.serviceId}
          label={linkedFilesService.serviceLabel}
          onSelect={() => {
            goto(getCloudServicePath(linkedFilesService), { transitionType: 'forwards' });
          }}
        >
          {#snippet startIcon()}
            <Icon name="link_2" />
          {/snippet}
          {#snippet endIcon()}
            <span class="count" aria-label="({_('x_assets', { values: { count: linkedCount } })})">
              {appNumberFormatter.current.format(linkedCount)}
            </span>
          {/snippet}
        </Option>
      </OptionGroup>
    {/if}
  </Listbox>
</nav>
