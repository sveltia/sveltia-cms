<script>
  import { _ } from '@sveltia/i18n';
  import { Toolbar } from '@sveltia/ui';

  import AssetResults from '$lib/components/search/asset-results.svelte';
  import EntryResults from '$lib/components/search/entry-results.svelte';
  import { searchMode } from '$lib/services/search';
  import { isSmallScreen } from '$lib/services/user/env';
</script>

<div role="none" class="wrapper">
  {#if !$isSmallScreen}
    <Toolbar variant="primary">
      <h2 role="none">{_('search_results')}</h2>
    </Toolbar>
  {/if}
  <div role="none" class="results">
    {#if $searchMode === 'contents'}
      <EntryResults />
    {/if}
    {#if $searchMode === 'assets'}
      <AssetResults />
    {/if}
  </div>
</div>

<style lang="scss">
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
