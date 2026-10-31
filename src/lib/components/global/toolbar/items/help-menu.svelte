<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Menu, MenuItem } from '@sveltia/ui';

  import ReleaseNotesMenuItem from '$lib/components/help/release-notes-menu-item.svelte';
  import ShortcutsMenuItem from '$lib/components/help/shortcuts-menu-item.svelte';
  import { DOCS_BASE_URL, REPOSITORY_URL } from '$lib/services/app';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import { openNewTab } from '$lib/services/utils/window';

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
    label={_(labelKey)}
    onclick={() => {
      openNewTab(url);
    }}
  />
{/snippet}

<Menu ariaLabel={_('help')}>
  <ShortcutsMenuItem {menuButton} />
  {#if prefs.devModeEnabled}
    {@render link('documentation', DOCS_BASE_URL)}
    <ReleaseNotesMenuItem />
    {@render link('announcements', `${REPOSITORY_URL}/discussions/categories/announcements`)}
    <Divider />
    {@render link('report_issue', `${REPOSITORY_URL}/issues`)}
    {@render link('share_feedback', `${REPOSITORY_URL}/discussions/categories/ideas`)}
    {@render link('get_help', `${REPOSITORY_URL}/discussions/categories/q-a`)}
    {@render link('donate', 'https://github.com/sponsors/kyoshino')}
    <Divider />
    {@render link('bluesky', 'https://bsky.app/profile/sveltiacms.app')}
    {@render link('join_discord', 'https://discord.com/invite/5hwCGqup5b')}
  {/if}
</Menu>
