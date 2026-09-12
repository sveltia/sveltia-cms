<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';

  import { goto, selectedPageName } from '$lib/services/app/navigation';
  import {
    enabledCloudServices,
    getCloudServicePath,
    selectedCloudService,
  } from '$lib/services/assets/external';
  import { allAssetFolders, selectedAssetFolder } from '$lib/services/assets/folders';
  import { backendName } from '$lib/services/backends';
  import { searchMode } from '$lib/services/search';
  import { env } from '$lib/services/user/env.svelte';
  import { workflowEnabled } from '$lib/services/workflow';

  /**
   * Link to the Asset Library: the folder list on small screens, otherwise the location shown
   * last, falling back to All Assets or, when no asset folder is configured, the first external
   * location.
   */
  const assetsLink = $derived.by(() => {
    if (env.isSmallScreen) {
      return '/assets';
    }

    if (selectedCloudService.current) {
      return getCloudServicePath(selectedCloudService.current);
    }

    if (allAssetFolders.current.length) {
      return `/assets/${selectedAssetFolder.current?.internalPath ?? '-/all'}`;
    }

    return getCloudServicePath(enabledCloudServices.current[0]);
  });

  const pages = $derived.by(() => {
    const _pages = [
      {
        key: 'collections',
        label: _('contents'),
        icon: 'article',
        link: '/collections',
        /** @type {string | undefined} */
        searchMode: 'contents',
      },
    ];

    // Hide the Assets page if there is nothing to show: no asset folder and no external location
    if (allAssetFolders.current.length || enabledCloudServices.current.length) {
      _pages.push({
        key: 'assets',
        label: _('assets'),
        icon: 'photo',
        link: assetsLink,
        searchMode: 'assets',
      });
    }

    if (workflowEnabled.current) {
      _pages.push({
        key: 'workflow',
        label: _('editorial_workflow'),
        icon: 'rebase_edit',
        link: '/workflow',
        searchMode: undefined,
      });
    }

    if (backendName.current === 'local') {
      // _pages.push({
      //   key: 'config',
      //   label: _('cms_config'),
      //   icon: 'settings',
      //   link: '/config',
      // });
    }

    if (env.isSmallScreen) {
      _pages.push({
        key: 'menu',
        label: _('menu'),
        icon: 'menu',
        link: '/menu',
        searchMode: undefined,
      });
    }

    return _pages;
  });
</script>

<div role="none" class="wrapper">
  <SelectButtonGroup aria-label={_('switch_page')} aria-controls="page-container">
    {#each pages as { key, label, icon, link, searchMode: sMode }, index (key)}
      <SelectButton
        variant="ghost"
        iconic
        selected={selectedPageName.current === key || searchMode.current === sMode}
        aria-label={label}
        keyShortcuts="Alt+{index + 1}"
        onclick={() => {
          goto(link);
        }}
      >
        {#snippet startIcon()}
          <Icon name={icon} />
        {/snippet}
      </SelectButton>
    {/each}
  </SelectButtonGroup>
</div>

<style>
  .wrapper {
    display: contents;

    :global {
      .sui.select-button-group {
        gap: 4px;

        @media (width < 768px) {
          justify-content: space-evenly;
          width: 100%;
        }
      }

      .sui.button {
        border-radius: var(--sui-button-medium-border-radius) !important;
      }
    }
  }
</style>
