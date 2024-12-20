<svelte:options runes={true} />

<script>
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import SearchResults from '$lib/components/search/search-results.svelte';
  import { announcedPageStatus, parseLocation } from '$lib/services/app/navigation';
  import { searchResults, searchTerms } from '$lib/services/search';

  const routeRegex = /^\/search\/(?<terms>.+)$/;

  /**
   * Navigate to the search page given the URL hash.
   */
  const navigate = () => {
    const { path } = parseLocation();
    const { terms } = path.match(routeRegex)?.groups ?? {};

    if (terms && terms !== $searchTerms) {
      $searchTerms = terms;
    }

    const { entries, assets } = $searchResults;
    const entryCount = entries.length;
    const assetCount = assets.length;

    $announcedPageStatus = $_('viewing_search_results', {
      values: {
        terms: $searchTerms,
        entries:
          entryCount > 1
            ? $_('many_entries', { values: { count: entryCount } })
            : entryCount === 1
              ? $_('one_entry')
              : $_('no_entries'),
        assets:
          assetCount > 1
            ? $_('many_assets', { values: { count: assetCount } })
            : assetCount === 1
              ? $_('one_asset')
              : $_('no_assets'),
      },
    });
  };

  onMount(() => {
    navigate();
  });
</script>

<svelte:window
  onhashchange={() => {
    navigate();
  }}
/>

<PageContainer
  class="content"
  aria-label={$_('search_results_for_x', { values: { terms: $searchTerms } })}
>
  {#snippet main()}
    <SearchResults />
  {/snippet}
</PageContainer>
