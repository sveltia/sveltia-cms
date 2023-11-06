<script>
  import { Toolbar } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import SearchResults from '$lib/components/search/search-results.svelte';
  import { parseLocation } from '$lib/services/navigation';
  import { searchTerms } from '$lib/services/search';

  /**
   * Navigate to the search page given the URL hash.
   */
  const navigate = () => {
    const { path } = parseLocation();
    const [, terms] = path.match(/^\/search\/(.+)$/) ?? [];

    if (terms && terms !== $searchTerms) {
      $searchTerms = terms;
    }
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

<PageContainer class="content">
  <Toolbar variant="primary" aria-label={$_('search_results_toolbar')} slot="primary_toolbar">
    <h2>{$_('search_results_for_x', { values: { terms: $searchTerms } })}</h2>
  </Toolbar>
  <SearchResults slot="main" />
</PageContainer>
