<script>
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import SearchResults from '$lib/components/search/search-results.svelte';
  import { announcedPageTitle, parseLocation } from '$lib/services/navigation';
  import { searchResults, searchTerms } from '$lib/services/search';

  /**
   * Navigate to the search page given the URL hash.
   */
  const navigate = () => {
    const { path } = parseLocation();
    const [, terms] = path.match(/^\/search\/(.+)$/) ?? [];

    if (terms && terms !== $searchTerms) {
      $searchTerms = terms;
    }

    const { entries, assets } = $searchResults;
    const entryCount = entries.length;
    const assetCount = assets.length;

    $announcedPageTitle = $_('viewing_search_results', {
      values: {
        terms: $searchTerms,
        entries:
          // eslint-disable-next-line no-nested-ternary
          entryCount > 1
            ? $_('many_entries', { values: { count: entryCount } })
            : entryCount === 1
              ? $_('one_entry')
              : $_('no_entry'),
        assets:
          // eslint-disable-next-line no-nested-ternary
          assetCount > 1
            ? $_('many_assets', { values: { count: assetCount } })
            : assetCount === 1
              ? $_('one_asset')
              : $_('no_asset'),
      },
    });
  };

  onMount(() => {
    navigate();
  });
</script>

<svelte:window
  on:hashchange={() => {
    navigate();
  }}
/>

<PageContainer
  class="content"
  aria-label={$_('search_results_for_x', { values: { terms: $searchTerms } })}
>
  <SearchResults slot="main" />
</PageContainer>
