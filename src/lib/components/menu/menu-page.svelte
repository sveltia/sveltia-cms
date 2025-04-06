<script>
  import { _ } from 'svelte-i18n';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import AccountMenu from '$lib/components/global/toolbar/items/account-menu.svelte';
  import HelpMenu from '$lib/components/global/toolbar/items/help-menu.svelte';
</script>

<PageContainer class="content" aria-label={$_('menu')}>
  {#snippet main()}
    <div role="none" class="wrapper">
      <section>
        <h3>{$_('account')}</h3>
        <AccountMenu />
      </section>
      <section>
        <h3>{$_('help')}</h3>
        <HelpMenu />
      </section>
    </div>
  {/snippet}
</PageContainer>

<style lang="scss">
  .wrapper {
    overflow-y: auto;
    width: 100%;
    height: 100%;
    --sui-menu-border-width: 0;
    --sui-menu-border-radius: 0;
    --sui-menu-padding: 8px 0;
  }

  h3 {
    padding: 8px 16px;
    background-color: var(--sui-tertiary-background-color);
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-normal);
  }
</style>
