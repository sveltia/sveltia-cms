<script>
  import { Spacer, Toolbar } from '@sveltia/ui';
  import AccountButton from '$lib/components/global/global-toolbar/items/account-button.svelte';
  import CreateButton from '$lib/components/global/global-toolbar/items/create-button.svelte';
  import NotificationsButton from '$lib/components/global/global-toolbar/items/notifications-button.svelte';
  import PageSwitcher from '$lib/components/global/global-toolbar/items/page-switcher.svelte';
  import QuickSearchBar from '$lib/components/global/global-toolbar/items/quick-search-bar.svelte';
  import SiteLogo from '$lib/components/global/global-toolbar/items/site-logo.svelte';
  import { entryDraft } from '$lib/services/contents/editor';
</script>

<div class="toolbar-wrapper" hidden={$entryDraft ? true : undefined}>
  <Toolbar>
    <SiteLogo />
    <PageSwitcher />
    <Spacer flex={true} />
    <QuickSearchBar />
    <Spacer flex={true} />
    <CreateButton />
    <NotificationsButton />
    <AccountButton />
  </Toolbar>
</div>

<style lang="scss">
  .toolbar-wrapper {
    display: contents;

    &[hidden] {
      display: none;
    }

    & > :global(.toolbar) {
      --toolbar-size: 48px;
      border-width: 0 0 1px 0 !important;
      border-color: var(--primary-border-color) !important;
      background-color: var(--tertiary-background-color);

      :global(.search-bar) {
        width: 640px;
      }
    }
  }
</style>
