<script>
  import { _ } from 'svelte-i18n';
  import AssetResults from '$lib/components/search/asset-results.svelte';
  import EntryResults from '$lib/components/search/entry-results.svelte';
  import { isSmallScreen } from '$lib/services/app/env';
  import { searchMode } from '$lib/services/search';

  /**
   * @import { Asset, Entry } from '$lib/types/private';
   */
</script>

<div role="none" class="wrapper">
  {#if !$isSmallScreen}
    <header role="none">
      <h2 role="none">{$_('search_results')}</h2>
    </header>
  {/if}
  <div role="none" class="results">
    {#if $searchMode === 'entries'}
      <EntryResults />
    {/if}
    {#if $searchMode === 'assets'}
      <AssetResults />
    {/if}
  </div>
</div>

<style lang="scss">
  .wrapper {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    width: 100%;
    background-color: var(--sui-primary-background-color);
  }

  header {
    flex: none;
    display: flex;
    align-items: center;
    padding: 0 16px;
    height: 40px;
    background-color: var(--sui-tertiary-background-color);

    h2 {
      font-size: var(--sui-font-size-x-large);
    }
  }

  .results {
    flex: auto;
    display: flex;
    gap: 16px;
    overflow: hidden;
    height: 100%;

    :global {
      & > .sui.group {
        flex: auto;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        width: 50%;
        height: 100%;
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
