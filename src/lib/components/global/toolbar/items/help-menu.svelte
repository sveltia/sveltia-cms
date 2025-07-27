<script>
  import { Divider, Menu, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import ReleaseNotesMenuItem from '$lib/components/help/release-notes-menu-item.svelte';
  import ShortcutsMenuItem from '$lib/components/help/shortcuts-menu-item.svelte';

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
</script>

{#snippet link(/** @type {string} */ labelKey, /** @type {string} */ url)}
  <MenuItem
    label={$_(labelKey)}
    onclick={() => {
      window.open(url, '_blank');
    }}
  />
{/snippet}

<Menu aria-label={$_('help')}>
  <ShortcutsMenuItem {menuButton} />
  {@render link('documentation', 'https://github.com/sveltia/sveltia-cms/blob/main/README.md')}
  <ReleaseNotesMenuItem />
  <Divider />
  {@render link('report_issue', 'https://github.com/sveltia/sveltia-cms/issues/new?type=bug')}
  {@render link(
    'share_feedback',
    'https://github.com/sveltia/sveltia-cms/discussions/new?category=general',
  )}
  {@render link('get_help', 'https://github.com/sveltia/sveltia-cms/discussions/new?category=q-a')}
  <Divider />
  {@render link('join_discord', 'https://discord.gg/5hwCGqup5b')}
</Menu>
