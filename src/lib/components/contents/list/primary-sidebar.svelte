<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Divider, Icon, OptionGroup, Tree, TreeItem } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import CollectionTreeItem from '$lib/components/contents/list/collection-tree-item.svelte';
  import SingletonTreeItem from '$lib/components/contents/list/singleton-tree-item.svelte';
  import PublishButton from '$lib/components/global/toolbar/items/publish-button.svelte';
  import QuickSearchBar from '$lib/components/global/toolbar/items/quick-search-bar.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { cmsConfig } from '$lib/services/config';
  import { selectedCollection } from '$lib/services/contents/collection';
  import { env } from '$lib/services/user/env.svelte';

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
  {#if env.isSmallScreen}
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
  <!-- The chevron is the only way to expand or collapse a folder, so that activating a collection
  or a folder always navigates to it -->
  <Tree
    aria-label={_('collection_list')}
    aria-controls="collection-container"
    expandOnSelect={false}
  >
    {#if collections.length}
      <OptionGroup label={_('collections')}>
        {#each collections as collection, index (collection.name ?? index)}
          {#await sleep() then}
            {#if !('divider' in collection)}
              <CollectionTreeItem {collection} {isSearchPage} />
            {:else if collection.divider}
              <Divider />
            {/if}
          {/await}
        {/each}
      </OptionGroup>
    {/if}
    {#if singletons.length}
      {#if env.isSmallScreen || collections.length}
        <!-- Use the user-friendly “Files” label instead of “Singletons” -->
        <OptionGroup label={_('files')}>
          {#each singletons as file, index (file.name ?? index)}
            {#await sleep() then}
              {#if !('divider' in file)}
                <SingletonTreeItem {file} />
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
          <TreeItem
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
          </TreeItem>
        </OptionGroup>
      {/if}
    {/if}
  </Tree>
</div>
