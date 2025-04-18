<script>
  import { MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { version } from '$lib/services/app';
  import { prefs } from '$lib/services/user/prefs';
</script>

<MenuItem
  label={$_('release_notes')}
  onclick={() => {
    window.open('https://github.com/sveltia/sveltia-cms/releases', '_blank');
  }}
>
  {#snippet endIcon()}
    {#if $prefs.devModeEnabled}
      <span class="version" aria-label="({$_('version_x', { values: { version } })})">
        v{version}
      </span>
    {/if}
  {/snippet}
</MenuItem>

<style lang="scss">
  .version {
    border-radius: 4px;
    padding: 0 6px;
    color: var(--sui-secondary-foreground-color);
    background-color: var(--sui-selected-background-color);
    font-size: var(--sui-font-size-small);
  }
</style>
