<svelte:options runes={true} />

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
      <HelpButton />
      <AccountButton />
    </div>
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
      }
    }
  }
</style>
