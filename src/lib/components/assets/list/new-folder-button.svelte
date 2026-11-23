<!--
  @component New Folder button, shared by repository folders and external locations.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  import { env } from '$lib/services/user/env.svelte';

  /**
   * @typedef {object} Props
   * @property {boolean} [disabled] Whether creating a folder is disabled.
   * @property {() => void} onclick Click handler.
   * @property {boolean} [floating] Whether the button becomes a floating button on a small screen,
   * like the one on the Asset Library page.
   */

  /** @type {Props} */
  let { disabled = false, onclick, floating = true } = $props();
</script>

<!-- The ghost button becomes a floating button on a small screen, where it needs a surface -->
<Button
  variant={floating && env.isSmallScreen ? 'secondary' : 'ghost'}
  iconic
  {disabled}
  aria-label={_('new_folder')}
  {onclick}
>
  {#snippet startIcon()}
    <Icon name="create_new_folder" />
  {/snippet}
</Button>
