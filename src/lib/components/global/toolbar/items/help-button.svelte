<script>
  import { Divider, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import ShortcutsDialog from '$lib/components/keyboard-shortcuts/shortcuts-dialog.svelte';
  import { version } from '$lib/services/app';
  import { prefs } from '$lib/services/prefs';

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
      <Menu aria-label={$_('help')}>
        <!-- Assume the user has a physical keyboard if the pointer is mouse (on desktop) -->
        {#if window.matchMedia('(pointer: fine)').matches}
          <MenuItem
            label={$_('keyboard_shortcuts')}
            onclick={() => {
              showShortcutsDialog = true;
            }}
          />
        {/if}
        <MenuItem
          label={$_('documentation')}
          onclick={() => {
            window.open('https://github.com/sveltia/sveltia-cms/blob/main/README.md', '_blank');
          }}
        />
        <MenuItem
          label={$_('release_notes')}
          onclick={() => {
            window.open('https://github.com/sveltia/sveltia-cms/releases', '_blank');
          }}
        >
          <!-- eslint-disable-next-line no-shadow -->
          {#snippet endIcon()}
            {#if $prefs.devModeEnabled}
              <span class="version" aria-label="({$_('version_x', { values: { version } })})">
                v{version}
              </span>
            {/if}
          {/snippet}
        </MenuItem>
        <Divider />
        <MenuItem
          label={$_('report_issue')}
          onclick={() => {
            window.open('https://github.com/sveltia/sveltia-cms/issues/new?labels=bug', '_blank');
          }}
        />
        <MenuItem
          label={$_('share_feedback')}
          onclick={() => {
            window.open(
              'https://github.com/sveltia/sveltia-cms/discussions/new?category=general',
              '_blank',
            );
          }}
        />
        <MenuItem
          label={$_('get_help')}
          onclick={() => {
            window.open(
              'https://github.com/sveltia/sveltia-cms/discussions/new?category=q-a',
              '_blank',
            );
          }}
        />
        <Divider />
        <MenuItem
          label={$_('join_discord')}
          onclick={() => {
            window.open('https://discord.gg/5hwCGqup5b', '_blank');
          }}
        />
      </Menu>
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

  .version {
    border-radius: 4px;
    padding: 0 6px;
    color: var(--sui-secondary-foreground-color);
    background-color: var(--sui-selected-background-color);
    font-size: var(--sui-font-size-small);
  }
</style>
