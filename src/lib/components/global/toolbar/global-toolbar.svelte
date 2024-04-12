<script>
  import { Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import AccountButton from '$lib/components/global/toolbar/items/account-button.svelte';
  import CreateButton from '$lib/components/global/toolbar/items/create-button.svelte';
  import NotificationsButton from '$lib/components/global/toolbar/items/notifications-button.svelte';
  import PageSwitcher from '$lib/components/global/toolbar/items/page-switcher.svelte';
  import QuickSearchBar from '$lib/components/global/toolbar/items/quick-search-bar.svelte';
  import SiteLogo from '$lib/components/global/toolbar/items/site-logo.svelte';
  import { hasOverlay } from '$lib/services/app/navigation';
</script>

<div role="none" class="toolbar-wrapper" inert={$hasOverlay}>
  <Toolbar variant="primary" aria-label={$_('global')}>
    <SiteLogo />
    <PageSwitcher />
    <Spacer flex />
    <QuickSearchBar />
    <Spacer flex />
    <CreateButton />
    <NotificationsButton />
    <AccountButton />
  </Toolbar>
</div>

<style lang="scss">
  .toolbar-wrapper {
    display: contents;

    &[inert] {
      // Disable the keyboard shortcut for the search bar
      display: none;
    }

    & > :global(.toolbar) {
      border-width: 0 0 1px 0 !important;

      :global(.search-bar) {
        width: 640px;
      }
    }
  }
</style>
