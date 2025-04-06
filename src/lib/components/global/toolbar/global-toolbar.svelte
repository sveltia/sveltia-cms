<script>
  import { Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import AccountButton from '$lib/components/global/toolbar/items/account-button.svelte';
  import CreateButton from '$lib/components/global/toolbar/items/create-button.svelte';
  import HelpButton from '$lib/components/global/toolbar/items/help-button.svelte';
  import NotificationsButton from '$lib/components/global/toolbar/items/notifications-button.svelte';
  import PageSwitcher from '$lib/components/global/toolbar/items/page-switcher.svelte';
  import PublishButton from '$lib/components/global/toolbar/items/publish-button.svelte';
  import QuickSearchBar from '$lib/components/global/toolbar/items/quick-search-bar.svelte';
  import SiteLogo from '$lib/components/global/toolbar/items/site-logo.svelte';
  import { isSmallScreen } from '$lib/services/app/env';
  import { goBack, hasOverlay } from '$lib/services/app/navigation';
  import { searchMode, searchTerms, showSearchBar } from '$lib/services/search';
</script>

{#if !$isSmallScreen || $showSearchBar}
  <div role="none" class="toolbar-wrapper" inert={$hasOverlay}>
    <Toolbar variant="primary" aria-label={$_('global')}>
      {#if $isSmallScreen}
        {#if $searchTerms}
          <BackButton
            aria-label={$_(
              $searchMode === 'assets' ? 'back_to_asset_folder_list' : 'back_to_collection_list',
            )}
            onclick={() => {
              $searchTerms = '';
              goBack($searchMode === 'assets' ? '/assets' : '/collections');
            }}
          />
        {:else}
          <SiteLogo />
        {/if}
        <QuickSearchBar />
      {:else}
        <div role="none" class="buttons">
          <SiteLogo />
          <PageSwitcher />
        </div>
        <QuickSearchBar />
        <div role="none" class="buttons">
          <PublishButton />
          <CreateButton />
          <NotificationsButton />
          <HelpButton />
          <AccountButton />
        </div>
      {/if}
    </Toolbar>
  </div>
{/if}

<style lang="scss">
  .toolbar-wrapper {
    display: contents;

    &[inert] {
      // Disable the keyboard shortcut for the search bar
      display: none;
    }

    & > :global(.toolbar) {
      @media (width < 768px) {
        padding: 0 4px;
      }

      :global(.buttons) {
        flex: auto;
        display: flex;
        align-items: center;
        width: 50%;

        &:last-child {
          justify-content: flex-end;
        }
      }

      :global(.search-bar) {
        flex: none;
        width: 640px;
        max-width: 50%;

        @media (width < 768px) {
          flex: auto;
          width: -moz-available;
          width: -webkit-fill-available;
          width: stretch;
          max-width: none;
        }
      }
    }
  }
</style>
