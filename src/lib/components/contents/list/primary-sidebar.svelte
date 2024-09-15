<script>
  import { Divider, Icon, Listbox, Option } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { goto } from '$lib/services/app/navigation';
  import { siteConfig } from '$lib/services/config';
  import { selectedCollection } from '$lib/services/contents';

  $: collections = $siteConfig?.collections.filter(({ hide }) => !hide) ?? [];
</script>

<div role="none" class="primary-sidebar">
  <Listbox aria-label={$_('collections')} aria-controls="collection-container">
    {#each collections as { name, label, icon, divider = false } (name)}
      {#if divider}
        <Divider />
      {:else}
        <Option
          label={label || name}
          selected={$selectedCollection?.name === name}
          onSelect={() => {
            goto(`/collections/${name}`);
          }}
        >
          {#snippet startIcon()}
            <Icon name={icon || 'edit_note'} />
          {/snippet}
        </Option>
      {/if}
    {/each}
  </Listbox>
</div>
