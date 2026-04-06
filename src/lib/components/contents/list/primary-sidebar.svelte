<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Divider, Icon, Listbox, Option, OptionGroup } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import SingletonOption from '$lib/components/contents/list/singleton-option.svelte';
  import PublishButton from '$lib/components/global/toolbar/items/publish-button.svelte';
  import QuickSearchBar from '$lib/components/global/toolbar/items/quick-search-bar.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { cmsConfig } from '$lib/services/config';
  import { allEntries } from '$lib/services/contents';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import { isSmallScreen } from '$lib/services/user/env';

  /**
   * @typedef {object} Props
   * @property {boolean} [isSearchPage] Whether the current page is the search results page.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    isSearchPage = false,
    /* eslint-enable prefer-const */
  } = $props();

  const numberFormatter = $derived(Intl.NumberFormat(appLocale.current));
  // @ts-ignore Dividers can be included in the collection list
  const collections = $derived($cmsConfig?.collections?.filter(({ hide }) => !hide) ?? []);
  const singletons = $derived($cmsConfig?.singletons ?? []);
</script>

<div role="none" class="primary-sidebar">
  {#if $isSmallScreen}
    <header>
      <h2>{_('contents')}</h2>
      <PublishButton />
    </header>
    <QuickSearchBar
      onclick={(event) => {
        event.preventDefault();
        goto('/search');
      }}
    />
  {/if}
  <Listbox aria-label={_('collection_list')} aria-controls="collection-container">
    {#if collections.length}
      <OptionGroup label={_('collections')}>
        {#each collections as collection, index (collection.name ?? index)}
          {#await sleep() then}
            {#if !('divider' in collection)}
              {@const { name, label, icon } = collection}
              <Option
                label={label || name}
                selected={$isSmallScreen || isSearchPage
                  ? false
                  : $selectedCollection?.name === name}
                onSelect={() => {
                  goto(`/collections/${name}`, { transitionType: 'forwards' });
                }}
              >
                {#snippet startIcon()}
                  <Icon name={icon || 'bookmark_manager'} />
                {/snippet}
                {#snippet endIcon()}
                  {#key $allEntries}
                    {@const count = (
                      'files' in collection ? collection.files : getEntriesByCollection(name)
                    ).length}
                    <span class="count" aria-label="({_('x_entries', { values: { count } })})">
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
    {/if}
    {#if singletons.length}
      {#if $isSmallScreen || collections.length}
        <!-- Use the user-friendly “Files” label instead of “Singletons” -->
        <OptionGroup label={_('files')}>
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
      {:else}
        <!-- Show the singletons just like a file collection -->
        {@const count = singletons.length}
        <OptionGroup label={_('collections')}>
          <Option
            label={_('files')}
            selected={$selectedCollection?.name === '_singletons'}
            onSelect={() => {
              goto('/collections/_singletons', { transitionType: 'forwards' });
            }}
          >
            {#snippet startIcon()}
              <Icon name="bookmark_manager" />
            {/snippet}
            {#snippet endIcon()}
              <span class="count" aria-label="({_('x_entries', { values: { count } })})">
                {numberFormatter.format(count)}
              </span>
            {/snippet}
          </Option>
        </OptionGroup>
      {/if}
    {/if}
  </Listbox>
</div>
