<script>
  import { Divider, Icon, Listbox, Option } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _ } from 'svelte-i18n';
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
                {@const count = (files ?? getEntriesByCollection(name)).length}
                <span
                  class="count"
                  aria-label="({$_(
                    // eslint-disable-next-line no-nested-ternary
                    count > 1 ? 'many_entries' : count === 1 ? 'one_entry' : 'no_entries',
                    { values: { count } },
                  )})"
                >
                  {count}
                </span>
              {/await}
            {/key}
          {/snippet}
        </Option>
      {/if}
    {/each}
  </Listbox>
</div>
