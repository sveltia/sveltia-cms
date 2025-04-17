<script>
  import { MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import ShortcutsDialog from '$lib/components/help/shortcuts-dialog.svelte';
  import { hasMouse } from '$lib/services/user/env';

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
{#if $hasMouse}
  <MenuItem
    label={$_('keyboard_shortcuts')}
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
