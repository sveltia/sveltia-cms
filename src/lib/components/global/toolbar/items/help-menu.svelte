<script>
  import { Divider, Menu, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import ShortcutsDialog from '$lib/components/help/shortcuts-dialog.svelte';
  import { version } from '$lib/services/app';
  import { hasMouse } from '$lib/services/user/env';
  import { prefs } from '$lib/services/user/prefs';

  /**
   * @typedef {object} Props
   * @property {import('@sveltia/ui').MenuButton} [menuButton] Menu button.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    menuButton,
    /* eslint-enable prefer-const */
  } = $props();

  let showShortcutsDialog = $state(false);
</script>

<Menu aria-label={$_('help')}>
  <!-- Assume the user has a physical keyboard if the pointer is mouse (on desktop) -->
  {#if $hasMouse}
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
      window.open('https://github.com/sveltia/sveltia-cms/issues/new?type=bug', '_blank');
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
      window.open('https://github.com/sveltia/sveltia-cms/discussions/new?category=q-a', '_blank');
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

<ShortcutsDialog
  bind:open={showShortcutsDialog}
  onClose={() => {
    menuButton?.focus();
  }}
/>

<style lang="scss">
  .version {
    border-radius: 4px;
    padding: 0 6px;
    color: var(--sui-secondary-foreground-color);
    background-color: var(--sui-selected-background-color);
    font-size: var(--sui-font-size-small);
  }
</style>
