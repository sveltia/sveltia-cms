<script>
  import { Spacer, Toolbar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import AccountMenu from '$lib/components/global/toolbar/items/account-menu.svelte';
  import HelpMenu from '$lib/components/global/toolbar/items/help-menu.svelte';
</script>

<PageContainer aria-label={$_('menu')}>
  {#snippet main()}
    <PageContainerMainArea>
      {#snippet primaryToolbar()}
        <Toolbar variant="primary">
          <h2 role="none">{$_('menu')}</h2>
          <Spacer flex />
        </Toolbar>
      {/snippet}
      {#snippet mainContent()}
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
    </PageContainerMainArea>
  {/snippet}
</PageContainer>

<style lang="scss">
  .wrapper {
    overflow-y: auto;
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
