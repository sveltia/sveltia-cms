<script>
  import { _ } from '@sveltia/i18n';
  import { Toolbar } from '@sveltia/ui';

  import PageContainerMainArea from '$lib/components/common/page-container-main-area.svelte';
  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import QuickSearchBar from '$lib/components/global/toolbar/items/quick-search-bar.svelte';
  import SearchResults from '$lib/components/search/search-results.svelte';
  import { goto } from '$lib/services/app/navigation';
  import { searchMode, searchTerms } from '$lib/services/search';
  import { isSmallScreen } from '$lib/services/user/env';
</script>

<PageContainerMainArea>
  {#snippet primaryToolbar()}
    {#if $isSmallScreen}
      <Toolbar variant="primary">
        <BackButton
          aria-label={_(
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
