<script>
  import { Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import AccountButton from '$lib/components/global/toolbar/items/account-button.svelte';
  import CreateButton from '$lib/components/global/toolbar/items/create-button.svelte';
  import HelpButton from '$lib/components/global/toolbar/items/help-button.svelte';
  import NotificationsButton from '$lib/components/global/toolbar/items/notifications-button.svelte';
  import PageSwitcher from '$lib/components/global/toolbar/items/page-switcher.svelte';
  import PublishButton from '$lib/components/global/toolbar/items/publish-button.svelte';
  import QuickSearchBar from '$lib/components/global/toolbar/items/quick-search-bar.svelte';
  import SiteLogo from '$lib/components/global/toolbar/items/site-logo.svelte';
  import { hasOverlay } from '$lib/services/app/navigation';
  import { prefs } from '$lib/services/user/prefs';
</script>

<div role="none" class="toolbar-wrapper" inert={$hasOverlay}>
  <Toolbar variant="primary" aria-label={$_('global')}>
    <div role="none" class="buttons">
      <SiteLogo />
      <PageSwitcher />
    </div>
    <QuickSearchBar />
    <div role="none" class="buttons">
      <PublishButton />
      <CreateButton />
      <NotificationsButton />
      {#if $prefs.devModeEnabled}
        <HelpButton />
      {/if}
      <AccountButton />
    </div>
  </Toolbar>
</div>

<style lang="scss">
  .toolbar-wrapper {
    display: contents;

    &[inert] {
      :global {
        .sui.search-bar {
          // Disable the keyboard shortcut for the search bar
          display: none !important;
        }
      }
    }

    :global {
      & > .sui.toolbar {
        --toolbar-background-color: var(--enterprise-nav-bg);
        color: var(--enterprise-nav-text);

        @media (width < 768px) {
          padding: 0 4px;
        }

        .buttons {
          flex: auto;
          display: flex;
          align-items: center;
          width: 50%;

          &:last-child {
            justify-content: flex-end;
          }

          // Style toolbar buttons for dark background
          .sui.button {
            color: var(--enterprise-nav-text);

            &:hover {
              color: var(--enterprise-nav-active);
            }
          }
        }

        // Style search bar for dark toolbar
        .sui.search-bar {
          flex: none;
          width: 640px;
          max-width: 50%;
          --sui-textbox-background-color: var(--enterprise-search-bg);
          --sui-textbox-border-color: var(--enterprise-search-border);
          --sui-textbox-foreground-color: var(--enterprise-nav-active);

          @media (width < 768px) {
            flex: auto;
            width: -moz-available;
            width: -webkit-fill-available;
            width: stretch;
            max-width: none;
          }
        }

        // Style heading text (page title) for dark background
        h2 {
          color: var(--enterprise-nav-active);
        }
      }
    }
  }
</style>
