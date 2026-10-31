<script>
  import { _ } from '@sveltia/i18n';
  import { MenuItem } from '@sveltia/ui';

  import { REPOSITORY_URL, version } from '$lib/services/app';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import { openNewTab } from '$lib/services/utils/window';
</script>

<MenuItem
  label={_('release_notes')}
  onclick={() => {
    openNewTab(`${REPOSITORY_URL}/releases`);
  }}
>
  {#snippet endIcon()}
    {#if prefs.devModeEnabled}
      <span class="version" aria-label="({_('version_x', { values: { version } })})">
        v{version}
      </span>
    {/if}
  {/snippet}
</MenuItem>

<style>
  .version {
    border-radius: 4px;
    padding: 0 6px;
    color: var(--sui-secondary-foreground-color);
    background-color: var(--sui-selected-background-color);
    font-size: var(--sui-font-size-small);
  }
</style>
