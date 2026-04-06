<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';

  import { goto, selectedPageName } from '$lib/services/app/navigation';
  import { allAssetFolders, selectedAssetFolder } from '$lib/services/assets/folders';
  import { backendName } from '$lib/services/backends';
  import { cmsConfig } from '$lib/services/config';
  import { searchMode } from '$lib/services/search';
  import { isSmallScreen } from '$lib/services/user/env';

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

    // Hide Assets page if there is no asset folder configured
    // @todo Remove this condition when the Asset Library supports external storage providers
    if ($allAssetFolders.length) {
      _pages.push({
        key: 'assets',
        label: _('assets'),
        icon: 'photo',
        link: $isSmallScreen
          ? '/assets'
          : `/assets/${$selectedAssetFolder?.internalPath ?? '-/all'}`,
        searchMode: 'assets',
      });
    }

    if ($cmsConfig?.publish_mode === 'editorial_workflow') {
      // _pages.push({
      //   key: 'workflow',
      //   label: _('editorial_workflow'),
      //   icon: 'rebase_edit',
      //   link: '/workflow',
      // });
    }

    if ($backendName === 'local') {
      // _pages.push({
      //   key: 'config',
      //   label: _('cms_config'),
      //   icon: 'settings',
      //   link: '/config',
      // });
    }

    if ($isSmallScreen) {
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
        selected={$selectedPageName === key || $searchMode === sMode}
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

<style lang="scss">
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
