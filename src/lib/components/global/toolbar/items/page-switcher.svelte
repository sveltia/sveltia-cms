<script>
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { goto, selectedPageName } from '$lib/services/app/navigation';
  import { selectedAssetFolder } from '$lib/services/assets';
  import { getFirstCollection, selectedCollection } from '$lib/services/contents/collection';
  import { isSmallScreen } from '$lib/services/user/env';

  const pages = $derived([
    {
      key: 'collections',
      label: $_('contents'),
      icon: 'library_books',
      link: $isSmallScreen
        ? '/collections'
        : `/collections/${$selectedCollection?.name ?? getFirstCollection()?.name}`,
    },
    {
      key: 'assets',
      label: $_('assets'),
      icon: 'photo_library',
      link: $isSmallScreen ? '/assets' : `/assets/${$selectedAssetFolder?.internalPath ?? '-/all'}`,
    },
    // {
    //   key: 'workflow',
    //   label: $_('editorial_workflow'),
    //   icon: 'rebase_edit',
    //   link: '/workflow',
    // },
    // {
    //   key: 'config',
    //   label: $_('site_config'),
    //   icon: 'settings',
    //   link: '/config',
    // },
    ...($isSmallScreen
      ? [
          {
            key: 'menu',
            label: $_('menu'),
            icon: 'menu',
            link: '/menu',
          },
        ]
      : []),
  ]);
</script>

<div role="none" class="wrapper">
  <SelectButtonGroup aria-label={$_('switch_page')} aria-controls="page-container">
    {#each pages as { key, label, icon, link }, index (key)}
      <SelectButton
        variant="ghost"
        iconic
        selected={$selectedPageName === key}
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
