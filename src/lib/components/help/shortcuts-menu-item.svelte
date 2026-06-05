<script>
  import { _ } from '@sveltia/i18n';
  import { MenuItem } from '@sveltia/ui';

  import ShortcutsDialog from '$lib/components/help/shortcuts-dialog.svelte';
  import { env } from '$lib/services/user/env.svelte';

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

  let showDialog = $state(false);
</script>

<!-- Assume the user has a physical keyboard if the pointer is mouse (on desktop) -->
{#if env.hasMouse}
  <MenuItem
    label={_('keyboard_shortcuts')}
    onclick={() => {
      showDialog = true;
    }}
  />
{/if}

<ShortcutsDialog
  bind:open={showDialog}
  onClose={() => {
    menuButton?.focus();
  }}
/>
