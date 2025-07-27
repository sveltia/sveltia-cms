<script>
  import { Toolbar } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import QuickSearchBar from '$lib/components/global/toolbar/items/quick-search-bar.svelte';
  import SearchResults from '$lib/components/search/search-results.svelte';
  import { goto, parseLocation } from '$lib/services/app/navigation';
  import { searchMode, searchTerms } from '$lib/services/search';
  import { isSmallScreen } from '$lib/services/user/env';

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

    $searchMode ??= 'entries';
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

<PageContainer aria-label={$_('search_results_for_x', { values: { terms: $searchTerms } })}>
  {#snippet main()}
    <PageContainerMainArea>
      {#snippet primaryToolbar()}
        {#if $isSmallScreen}
          <Toolbar variant="primary">
            <BackButton
              aria-label={$_(
                $searchMode === 'assets' ? 'back_to_asset_folder_list' : 'back_to_collection_list',
              )}
              onclick={() => {
                $searchTerms = '';
                goto($searchMode === 'assets' ? '/assets' : '/collections', {
                  transitionType: 'backwards',
                });
              }}
            />
            <div role="search">
              <QuickSearchBar />
            </div>
          </Toolbar>
        {/if}
      {/snippet}
      {#snippet mainContent()}
        <SearchResults />
      {/snippet}
    </PageContainerMainArea>
  {/snippet}
</PageContainer>

<style lang="scss">
  [role='search'] {
    display: contents;

    :global {
      .sui.search-bar {
        flex: auto;
      }
    }
  }
</style>
