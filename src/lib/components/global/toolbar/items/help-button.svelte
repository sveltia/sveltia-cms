<script>
  import { Icon, MenuButton } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import HelpMenu from '$lib/components/global/toolbar/items/help-menu.svelte';
  import ShortcutsDialog from '$lib/components/help/shortcuts-dialog.svelte';

  /** @type {MenuButton | undefined} */
  let menuButton = $state();
  let showShortcutsDialog = $state(false);
</script>

<div role="none" class="wrapper">
  <MenuButton
    variant="ghost"
    iconic
    popupPosition="bottom-right"
    aria-label={$_('show_help_menu')}
    bind:this={menuButton}
  >
    {#snippet endIcon()}
      <Icon name={'help'} />
    {/snippet}
    {#snippet popup()}
      <HelpMenu {menuButton} />
    {/snippet}
  </MenuButton>
</div>

<ShortcutsDialog
  bind:open={showShortcutsDialog}
  onClose={() => {
    menuButton?.focus();
  }}
/>

<style lang="scss">
  .wrapper {
    display: contents;
  }
</style>
