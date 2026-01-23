<script>
  import { Divider, Menu, MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import ReleaseNotesMenuItem from '$lib/components/help/release-notes-menu-item.svelte';
  import ShortcutsMenuItem from '$lib/components/help/shortcuts-menu-item.svelte';
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
  {#if $prefs.devModeEnabled}
    {@render link('documentation', 'https://sveltiacms.app/en/docs')}
    <ReleaseNotesMenuItem />
    {@render link(
      'announcements',
      'https://github.com/sveltia/sveltia-cms/discussions/categories/announcements',
    )}
    <Divider />
    {@render link('report_issue', 'https://github.com/sveltia/sveltia-cms/issues')}
    {@render link(
      'share_feedback',
      'https://github.com/sveltia/sveltia-cms/discussions/categories/ideas',
    )}
    {@render link('get_help', 'https://github.com/sveltia/sveltia-cms/discussions/categories/q-a')}
    <Divider />
    {@render link('bluesky', 'https://bsky.app/profile/sveltiacms.app')}
    {@render link('join_discord', 'https://discord.com/invite/5hwCGqup5b')}
  {/if}
</Menu>
