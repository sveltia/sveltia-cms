<script>
  import { Divider, Icon, Listbox, Option, OptionGroup } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { _, locale as appLocale } from 'svelte-i18n';
  import SingletonOption from '$lib/components/contents/list/singleton-option.svelte';
  import QuickSearchBar from '$lib/components/global/toolbar/items/quick-search-bar.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { siteConfig } from '$lib/services/config';
  import { allEntries } from '$lib/services/contents';
  import { getValidCollections, selectedCollection } from '$lib/services/contents/collection';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import { isSmallScreen } from '$lib/services/user/env';

  const numberFormatter = $derived(Intl.NumberFormat($appLocale ?? undefined));
  const collections = $derived(getValidCollections({ visible: true }));
  const singletons = $derived($siteConfig?.singletons ?? []);
</script>

<div role="none" class="primary-sidebar">
  {#if $isSmallScreen}
    <h2>{$_('contents')}</h2>
    <QuickSearchBar
      onclick={(event) => {
        event.preventDefault();
        goto('/search');
      }}
    />
  {/if}
  <Listbox aria-label={$_('collection_list')} aria-controls="collection-container">
    <OptionGroup label={$_('collections')}>
      {#each collections as collection, index (collection.name ?? index)}
        {#await sleep() then}
          {#if !('divider' in collection)}
            {@const { name, label, icon, files } = collection}
            <Option
              label={label || name}
              selected={$isSmallScreen ? false : $selectedCollection?.name === name}
              onSelect={() => {
                goto(`/collections/${name}`, { transitionType: 'forwards' });
              }}
            >
              {#snippet startIcon()}
                <Icon name={icon || 'bookmark_manager'} />
              {/snippet}
              {#snippet endIcon()}
                {#key $allEntries}
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
                {/key}
              {/snippet}
            </Option>
          {:else if collection.divider}
            <Divider />
          {/if}
        {/await}
      {/each}
    </OptionGroup>
    {#if singletons.length}
      <!-- Use the user-friendly “Files” label instead of “Singletons” -->
      <OptionGroup label={$_('files')}>
        {#each singletons as file, index (file.name ?? index)}
          {#await sleep() then}
            {#if !('divider' in file)}
              <SingletonOption {file} />
            {:else if file.divider}
              <Divider />
            {/if}
          {/await}
        {/each}
      </OptionGroup>
    {/if}
  </Listbox>
</div>
