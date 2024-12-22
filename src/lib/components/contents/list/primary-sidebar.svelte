<script>
  import { Divider, Icon, Listbox, Option } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _, locale as appLocale } from 'svelte-i18n';
  import { goto } from '$lib/services/app/navigation';
  import { siteConfig } from '$lib/services/config';
  import { allEntries } from '$lib/services/contents';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';

  const numberFormatter = $derived(Intl.NumberFormat($appLocale ?? undefined));
  const collections = $derived($siteConfig?.collections.filter(({ hide }) => !hide) ?? []);
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
                    count > 1 ? 'many_entries' : count === 1 ? 'one_entry' : 'no_entries',
                    { values: { count } },
                  )})"
                >
                  {numberFormatter.format(count)}
                </span>
              {/await}
            {/key}
          {/snippet}
        </Option>
      {/if}
    {/each}
  </Listbox>
</div>
