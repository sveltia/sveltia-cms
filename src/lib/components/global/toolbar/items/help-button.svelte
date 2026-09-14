<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, MenuButton } from '@sveltia/ui';

  import HelpMenu from '$lib/components/global/toolbar/items/help-menu.svelte';

  /** @type {MenuButton | undefined} */
  let menuButton = $state();
</script>

<div role="none" class="wrapper">
  <MenuButton
    variant="ghost"
    iconic
    popupPosition="bottom-right"
    aria-label={_('show_help_menu')}
    bind:this={menuButton}
  >
    {#snippet endIcon()}
      <Icon name="help" />
    {/snippet}
    {#snippet popup()}
      <HelpMenu {menuButton} />
    {/snippet}
  </MenuButton>
</div>

<style>
  .wrapper {
    display: contents;
  }
</style>
