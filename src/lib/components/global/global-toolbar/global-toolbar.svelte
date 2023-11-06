<script>
  import { Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import AccountButton from '$lib/components/global/global-toolbar/items/account-button.svelte';
  import CreateButton from '$lib/components/global/global-toolbar/items/create-button.svelte';
  import NotificationsButton from '$lib/components/global/global-toolbar/items/notifications-button.svelte';
  import PageSwitcher from '$lib/components/global/global-toolbar/items/page-switcher.svelte';
  import QuickSearchBar from '$lib/components/global/global-toolbar/items/quick-search-bar.svelte';
  import SiteLogo from '$lib/components/global/global-toolbar/items/site-logo.svelte';
  import { entryDraft } from '$lib/services/contents/editor';
</script>

<div class="toolbar-wrapper" inert={$entryDraft ? true : undefined}>
  <Toolbar variant="primary" aria-label={$_('global_toolbar')}>
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
