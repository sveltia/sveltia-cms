<!--
  @component
  List of the locations the Select Assets dialog can pick assets from: the repository folders, the
  cloud storage services and Enter URL, and the stock asset providers. It’s a list box on a large
  screen, and a drop-down list on a small one.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, Listbox, Option, OptionGroup, Select } from '@sveltia/ui';

  import { isFolderOffered } from '$lib/services/assets/browser/select-assets-dialog.svelte';
  import {
    activated as cloudinaryActivated,
    dialogOpen as cloudinaryDialogOpen,
  } from '$lib/services/integrations/media-libraries/cloud/cloudinary';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { AssetLibraryFolderMap, MediaLibraryService } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} libraryName Name of the selected location.
   * @property {AssetLibraryFolderMap} assetLibraryFolderMap Default asset library folder map.
   * @property {boolean} showRepository Whether to offer the repository folders.
   * @property {boolean} selectFolder Whether a folder is to be selected instead of files, which
   * limits the repository folders to those that can be browsed by subfolder.
   * @property {[string, MediaLibraryService][]} cloudServiceEntries Cloud storage services offered.
   * @property {boolean} showURLInput Whether to offer Enter URL.
   * @property {[string, MediaLibraryService][]} stockAssetProviderEntries Stock asset providers
   * offered.
   * @property {string} controlsId ID of the content pane the selected location is shown in.
   * @property {(name: string) => void} onChange Function called with the name of the location
   * selected by the user.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    libraryName,
    assetLibraryFolderMap,
    showRepository,
    selectFolder,
    cloudServiceEntries,
    showURLInput,
    stockAssetProviderEntries,
    controlsId,
    onChange,
    /* eslint-enable prefer-const */
  } = $props();

  const Selector = $derived(env.isSmallScreen ? Select : Listbox);
</script>

{#snippet locationOption(
  /**
   * @type {{
   * name: string,
   * label: string,
   * icon: string,
   * onclick?: () => void,
   * }}
   */ { name, label, icon, onclick },
)}
  <Option {name} {label} selected={libraryName === name} {onclick}>
    {#snippet startIcon()}
      <Icon name={icon} />
    {/snippet}
  </Option>
{/snippet}

<Selector
  class="tabs"
  ariaLabel={_('assets_dialog.locations')}
  aria-controls={controlsId}
  filterThreshold={-1}
  onChange={(event) => {
    onChange(event.detail.name);
  }}
>
  {#if showRepository}
    <OptionGroup label={_('asset_location.repository')}>
      {#each Object.entries(assetLibraryFolderMap) as [id, entry] (id)}
        {#if isFolderOffered(entry, selectFolder)}
          {@render locationOption({
            name: `default-${id}`,
            label: entry.folder?.label || _(`assets_dialog.folder.${id}`),
            icon: 'folder',
          })}
        {/if}
      {/each}
    </OptionGroup>
  {/if}
  {#if showURLInput || !!cloudServiceEntries.length}
    <OptionGroup label={_('asset_location.external')}>
      {#each cloudServiceEntries as [, { serviceId, serviceLabel }] (serviceId)}
        {@render locationOption({
          name: serviceId,
          label: serviceLabel,
          icon: 'cloud',
          /**
           * Open the Cloudinary widget, once activated, when its location is clicked.
           */
          onclick: () => {
            if (serviceId === 'cloudinary' && cloudinaryActivated.current) {
              cloudinaryDialogOpen.current = true;
            }
          },
        })}
      {/each}
      {#if showURLInput}
        {@render locationOption({
          name: 'enter-url',
          label: _('assets_dialog.enter_url'),
          icon: 'link_2',
        })}
      {/if}
    </OptionGroup>
  {/if}
  {#if stockAssetProviderEntries.length}
    <OptionGroup label={_('asset_location.stock_photos')}>
      {#each stockAssetProviderEntries as [serviceId, { serviceLabel }] (serviceId)}
        {@render locationOption({
          name: serviceId,
          label: serviceLabel,
          icon: 'photo_camera_back',
        })}
      {/each}
    </OptionGroup>
  {/if}
</Selector>
