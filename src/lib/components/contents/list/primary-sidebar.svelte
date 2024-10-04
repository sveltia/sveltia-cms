<script>
  import { Divider, Icon, Listbox, Option } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';
  import SidebarItemCount from '$lib/components/common/sidebar-item-count.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { siteConfig } from '$lib/services/config';
  import { allEntries, getEntriesByCollection, selectedCollection } from '$lib/services/contents';

  $: collections = $siteConfig?.collections.filter(({ hide }) => !hide) ?? [];
</script>

<div role="none" class="primary-sidebar">
  <Listbox aria-label={$_('collections')} aria-controls="collection-container">
    {#each collections as { name, label, icon, files, divider = false } (name)}
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
          {#snippet endIcon()}
            {#key $allEntries}
              {#await sleep(0) then}
                <SidebarItemCount
                  type="entries"
                  count={(files ?? getEntriesByCollection(name)).length}
                />
              {/await}
            {/key}
          {/snippet}
        </Option>
      {/if}
    {/each}
  </Listbox>
</div>
