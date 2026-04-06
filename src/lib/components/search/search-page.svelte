<script>
  import { _ } from '@sveltia/i18n';
  import { onMount } from 'svelte';

  import PageContainer from '$lib/components/common/page-container.svelte';
  import SearchMainArea from '$lib/components/search/search-main-area.svelte';
  import { parseLocation } from '$lib/services/app/navigation';
  import { searchMode, searchTerms } from '$lib/services/search';

  const ROUTE_REGEX = /^\/search\/(?<terms>.+)$/;

  /**
   * Navigate to the search page given the URL hash.
   */
  const navigate = () => {
    const { path } = parseLocation();
    const { terms } = path.match(ROUTE_REGEX)?.groups ?? {};

    if (terms && terms !== $searchTerms) {
      $searchTerms = terms;
    }

    $searchMode ??= 'contents';
  };

  onMount(() => {
    navigate();

    /** @type {HTMLInputElement} */ (document.querySelector('.sui.search-bar input'))?.focus();
  });
</script>

<svelte:window
  onhashchange={() => {
    navigate();
  }}
/>

<PageContainer aria-label={_('search_results_for_x', { values: { terms: $searchTerms } })}>
  {#snippet main()}
    <SearchMainArea />
  {/snippet}
</PageContainer>
