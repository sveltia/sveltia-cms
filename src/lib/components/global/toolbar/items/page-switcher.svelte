<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';

  import {
    customPages,
    getCustomPagePath,
    openCustomPage,
    selectedCustomPageId,
  } from '$lib/services/app/custom-pages';
  import { goto, selectedPageName } from '$lib/services/app/navigation';
  import {
    enabledCloudServices,
    getCloudServicePath,
    selectedCloudService,
  } from '$lib/services/assets/external';
  import { linkedAssets, linkedFilesService } from '$lib/services/assets/external/linked';
  import { allAssetFolders, selectedAssetFolder } from '$lib/services/assets/folders';
  import { searchMode } from '$lib/services/search';
  import { env } from '$lib/services/user/env.svelte';
  import { encodePathSegments } from '$lib/services/utils/url';
  import { workflowEnabled } from '$lib/services/workflow';
  import { workflowPageLabelKey } from '$lib/services/workflow/stages';

  /**
   * Link to the Asset Library: the folder list on small screens, otherwise the location shown
   * last, falling back to All Assets or, when no asset folder is configured, the first external
   * location or Linked Files.
   */
  const assetsLink = $derived.by(() => {
    if (env.isSmallScreen) {
      return '/assets';
    }

    if (selectedCloudService.current) {
      return getCloudServicePath(selectedCloudService.current);
    }

    if (allAssetFolders.current.length) {
      return encodePathSegments(`/assets/${selectedAssetFolder.current?.internalPath ?? '-/all'}`);
    }

    return getCloudServicePath(enabledCloudServices.current[0] ?? linkedFilesService);
  });

  /**
   * Custom pages listed here. On small screens, they’re listed on the Menu page instead, as the
   * bottom navigation has little room.
   */
  const listedCustomPages = $derived(env.isSmallScreen ? [] : customPages.current);
  /**
   * Custom pages opening in a new tab, which are not pages to switch to, so they’re listed after
   * the page buttons.
   */
  const customLinks = $derived(listedCustomPages.filter(({ newTab }) => newTab));

  const pages = $derived.by(() => {
    /** @type {{ key: string, label: string, icon: string, link: string, selected: boolean }[]} */
    const _pages = [
      {
        key: 'collections',
        label: _('contents'),
        icon: 'article',
        link: '/collections',
        selected: selectedPageName.current === 'collections' || searchMode.current === 'contents',
      },
    ];

    // Hide the Assets page if there is nothing to show: no asset folder, no external location and
    // no linked file
    if (
      allAssetFolders.current.length ||
      enabledCloudServices.current.length ||
      linkedAssets.current.length
    ) {
      _pages.push({
        key: 'assets',
        label: _('assets'),
        icon: 'photo',
        link: assetsLink,
        selected: selectedPageName.current === 'assets' || searchMode.current === 'assets',
      });
    }

    if (workflowEnabled.current) {
      _pages.push({
        key: 'workflow',
        label: _(workflowPageLabelKey.current),
        icon: 'rebase_edit',
        link: '/workflow',
        selected: selectedPageName.current === 'workflow',
      });
    }

    listedCustomPages
      .filter(({ newTab }) => !newTab)
      .forEach((page) => {
        _pages.push({
          key: `pages/${page.id}`,
          label: page.label,
          icon: page.icon,
          link: getCustomPagePath(page),
          selected: selectedCustomPageId.current === page.id,
        });
      });

    if (env.isSmallScreen) {
      _pages.push({
        key: 'menu',
        label: _('menu'),
        icon: 'menu',
        link: '/menu',
        selected: selectedPageName.current === 'menu',
      });
    }

    return _pages;
  });
</script>

<div role="none" class="wrapper">
  <SelectButtonGroup ariaLabel={_('switch_page')} aria-controls="page-container">
    {#each pages as { key, label, icon, link, selected }, index (key)}
      <SelectButton
        variant="ghost"
        iconic
        {selected}
        aria-label={label}
        keyShortcuts={index < 9 ? `Alt+${index + 1}` : undefined}
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
  {#each customLinks as page (page.id)}
    <Button
      variant="ghost"
      iconic
      aria-label={page.label}
      onclick={() => {
        openCustomPage(page);
      }}
    >
      {#snippet startIcon()}
        <Icon name={page.icon} />
      {/snippet}
    </Button>
  {/each}
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
