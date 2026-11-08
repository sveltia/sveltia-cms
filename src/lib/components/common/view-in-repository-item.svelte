<!--
  @component
  Developer mode menu item that opens a file in the repository, named after the Git hosting service.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { MenuItem } from '@sveltia/ui';

  import { backend } from '$lib/services/backends';
  import { prefs } from '$lib/services/user/prefs.svelte';

  /**
   * @typedef {object} Props
   * @property {boolean} disabled Whether the item is disabled.
   * @property {() => void} onclick Click handler, which opens the file.
   */

  /** @type {Props} */
  let { disabled, onclick } = $props();

  const serviceLabel = $derived(backend.current?.repository?.label);
</script>

{#if prefs.devModeEnabled}
  <MenuItem
    {disabled}
    label={serviceLabel
      ? _('view_on_x', { values: { service: serviceLabel } })
      : _('view_in_repository')}
    {onclick}
  />
{/if}
