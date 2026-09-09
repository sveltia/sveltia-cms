<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Icon, TreeItem } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import NestedTreeItem from '$lib/components/contents/list/nested-tree-item.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { allEntries } from '$lib/services/contents';
  import { getCollection, selectedCollection } from '$lib/services/contents/collection';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import { nestedFilterPath } from '$lib/services/contents/collection/nested';
  import { getNestedTree } from '$lib/services/contents/collection/nested/tree';
  import { env } from '$lib/services/user/env.svelte';
  import { mergeUnpublishedEntries, unpublishedEntries } from '$lib/services/workflow';

  /**
   * @import { Collection } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {Collection} collection Collection to display.
   * @property {boolean} [isSearchPage] Whether the current page is the search results page.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    collection,
    isSearchPage = false,
    /* eslint-enable prefer-const */
  } = $props();

  const numberFormatter = $derived(Intl.NumberFormat(appLocale.current));
  const { name, label, icon } = $derived(collection);
  const isCurrentCollection = $derived($selectedCollection?.name === name);

  const selected = $derived(
    env.isSmallScreen || isSearchPage ? false : isCurrentCollection && !$nestedFilterPath,
  );

  // `$allEntries` is a key, because `getEntriesByCollection()` reads it indirectly, while
  // `$unpublishedEntries` is tracked as a normal dependency
  const entryCount = $derived.by(() => {
    void $allEntries;

    return (
      'files' in collection
        ? collection.files
        : mergeUnpublishedEntries(
            getEntriesByCollection(name),
            $unpublishedEntries.filter(({ workflow }) => workflow.collectionName === name),
          )
    ).length;
  });

  const treeNodes = $derived.by(() => {
    void $allEntries;

    const internalCollection = getCollection(name);

    return internalCollection
      ? getNestedTree({ collection: internalCollection, entries: getEntriesByCollection(name) })
      : [];
  });

  let expanded = $state(false);

  // Open the collection’s folder tree as soon as the user starts browsing it
  $effect(() => {
    if (isCurrentCollection) {
      untrack(() => {
        expanded = true;
      });
    }
  });
</script>

{#snippet folderItems()}
  {#each treeNodes as node (node.path)}
    <NestedTreeItem {node} collectionName={name} />
  {/each}
{/snippet}

<TreeItem
  label={label || name}
  {selected}
  bind:expanded
  items={treeNodes.length ? folderItems : undefined}
  onSelect={() => {
    goto(`/collections/${name}`, { transitionType: 'forwards' });
  }}
>
  {#snippet startIcon()}
    <Icon name={icon || 'bookmark_manager'} />
  {/snippet}
  {#snippet endIcon()}
    <span class="count" aria-label="({_('x_entries', { values: { count: entryCount } })})">
      {numberFormatter.format(entryCount)}
    </span>
  {/snippet}
</TreeItem>
