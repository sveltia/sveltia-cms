<script>
  import { _ } from '@sveltia/i18n';
  import { Toolbar } from '@sveltia/ui';

  import AssetResultItem from '$lib/components/search/asset-result-item.svelte';
  import EntryResultItem from '$lib/components/search/entry-result-item.svelte';
  import SearchResultList from '$lib/components/search/search-result-list.svelte';
  import { searchMode } from '$lib/services/search';
  import { assetSearchResults } from '$lib/services/search/assets';
  import { entrySearchResults } from '$lib/services/search/entries';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { Asset, EntrySearchResult } from '$lib/types/private';
   */
</script>

<div role="none" class="wrapper">
  {#if !env.isSmallScreen}
    <Toolbar variant="primary">
      <h2 role="none">{_('search_results')}</h2>
    </Toolbar>
  {/if}
  <div role="none" class="results">
    {#if searchMode.current === 'contents'}
      <SearchResultList
        items={entrySearchResults.current}
        itemKey="id"
        label={_('entries')}
        emptyMessage={_('no_entries_found')}
        statusMessageKey="viewing_entry_search_results"
      >
        {#snippet renderItem(/** @type {EntrySearchResult} */ result)}
          <EntryResultItem {result} />
        {/snippet}
      </SearchResultList>
    {/if}
    {#if searchMode.current === 'assets'}
      <SearchResultList
        items={assetSearchResults.current}
        itemKey="path"
        label={_('assets')}
        emptyMessage={_('no_files_found')}
        statusMessageKey="viewing_asset_search_results"
      >
        {#snippet renderItem(/** @type {Asset} */ asset)}
          <AssetResultItem {asset} />
        {/snippet}
      </SearchResultList>
    {/if}
  </div>
</div>

<style>
  .wrapper {
    flex: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
    background-color: var(--sui-primary-background-color);
  }

  .results {
    flex: auto;
    overflow: auto;

    :global {
      & > .sui.group {
        display: contents;

        & > .inner > div {
          display: contents;
        }
      }

      h3 {
        flex: none;
        margin: 16px;
        color: var(--sui-secondary-foreground-color);
        font-size: var(--sui-font-size-large);

        & + div {
          overflow: auto;
          flex: auto;
        }

        @media (width < 768px) {
          display: none;
        }
      }
    }
  }
</style>
