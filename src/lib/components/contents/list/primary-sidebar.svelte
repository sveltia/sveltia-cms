<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Icon, OptionGroup, Tree, TreeItem } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  import CollectionTreeItem from '$lib/components/contents/list/collection-tree-item.svelte';
  import SingletonTreeItem from '$lib/components/contents/list/singleton-tree-item.svelte';
  import PublishButton from '$lib/components/global/toolbar/items/publish-button.svelte';
  import QuickSearchBar from '$lib/components/global/toolbar/items/quick-search-bar.svelte';
  import { appNumberFormatter } from '$lib/services/app/i18n';
  import { goto } from '$lib/services/app/navigation';
  import { cmsConfig } from '$lib/services/config';
  import { hasSingletonList, selectedCollection } from '$lib/services/contents/collection';
  import { SINGLETONS_COLLECTION_NAME } from '$lib/services/contents/collection/constants';
  import { hasNestedEntries } from '$lib/services/contents/collection/nested';
  import { isSingletonCollection } from '$lib/services/contents/collection/predicates';
  import { getCollectionPath } from '$lib/services/contents/editor/route';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @typedef {object} Props
   * @property {boolean} [isSearchPage] Whether the current page is the search results page.
   */

  /** @type {Props} */
  let { isSearchPage = false } = $props();

  // @ts-ignore Dividers can be included in the collection list
  const collections = $derived(cmsConfig.current?.collections?.filter(({ hide }) => !hide) ?? []);
  const singletons = $derived(cmsConfig.current?.singletons ?? []);
  // The singletons get an entry list of their own, like a file collection, only when there is no
  // visible collection to show instead; a small screen lists every collection and file
  const singletonListShown = $derived(!env.isSmallScreen && hasSingletonList());
  const singletonListSelected = $derived(
    !!selectedCollection.current && isSingletonCollection(selectedCollection.current),
  );
  // Only a collection with nested entries has a folder tree, and with it a chevron in front of its
  // icon. Without one, nothing in the list can expand, so the space kept for the chevrons is
  // dropped.
  const hasAnyNestedEntries = $derived(
    collections.some((collection) => !('divider' in collection) && hasNestedEntries(collection)),
  );
</script>

<nav class="primary-sidebar" aria-label={_('contents')}>
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
    class={hasAnyNestedEntries ? undefined : 'flat'}
    ariaLabel={_('collection_list')}
    aria-controls={isSearchPage || env.isSmallScreen ? undefined : 'collection-container'}
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
      {#if !singletonListShown}
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
        {@const count = singletons.filter((file) => !('divider' in file)).length}
        <OptionGroup label={_('collections')}>
          <TreeItem
            label={_('files')}
            selected={singletonListSelected}
            onSelect={() => {
              goto(getCollectionPath(SINGLETONS_COLLECTION_NAME), { transitionType: 'forwards' });
            }}
          >
            {#snippet startIcon()}
              <Icon name="bookmark_manager" />
            {/snippet}
            {#snippet endIcon()}
              <span class="count" aria-label={_('x_entries', { values: { count } })}>
                {appNumberFormatter.current.format(count)}
              </span>
            {/snippet}
          </TreeItem>
        </OptionGroup>
      {/if}
    {/if}
  </Tree>
</nav>
