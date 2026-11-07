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
   */

  /** @type {Props} */
  let { disabled = false, onclick } = $props();
</script>

<!-- The ghost button becomes a floating button on a small screen, where it needs a surface -->
<Button
  variant={env.isSmallScreen ? 'secondary' : 'ghost'}
  iconic
  {disabled}
  aria-label={_('new_folder')}
  {onclick}
>
  {#snippet startIcon()}
    <Icon name="create_new_folder" />
  {/snippet}
</Button>
