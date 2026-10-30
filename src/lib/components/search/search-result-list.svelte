<!--
  @component
  List of search results, shared by entries and assets: a grid of the matching items, or an empty
  state when nothing matches the search terms.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { EmptyState, Group, InfiniteScroll } from '@sveltia/ui';

  import ListingGrid from '$lib/components/common/listing-grid.svelte';
  import { announcedPageStatus } from '$lib/services/app/navigation';
  import { searchTerms } from '$lib/services/search';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {any[]} items Matching items.
   * @property {string} itemKey Property of an item that identifies it in the list.
   * @property {string} label Name of the result type, used as the accessible name of the group
   * and the grid.
   * @property {string} emptyMessage Message shown when nothing matches the search terms.
   * @property {string} statusMessageKey Key of the message announced to screen readers, given the
   * search terms and the result count.
   * @property {Snippet<[any]>} renderItem Renders a listed item.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    items,
    itemKey,
    label,
    emptyMessage,
    statusMessageKey,
    renderItem,
    /* eslint-enable prefer-const */
  } = $props();

  $effect(() => {
    announcedPageStatus.current = _(statusMessageKey, {
      values: {
        terms: searchTerms.current,
        count: items.length,
      },
    });
  });
</script>

<Group ariaLabel={label}>
  <div role="none">
    {#if items.length}
      <ListingGrid viewType="list" aria-label={label} aria-rowcount={items.length}>
        {#key searchTerms.current}
          <InfiniteScroll {items} {itemKey} {renderItem} />
        {/key}
      </ListingGrid>
    {:else if searchTerms.current}
      <EmptyState>
        <span role="none">{emptyMessage}</span>
      </EmptyState>
    {/if}
  </div>
</Group>
