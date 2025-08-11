<script>
  import { SearchBar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { goBack, goto, parseLocation } from '$lib/services/app/navigation';
  import { searchMode, searchTerms } from '$lib/services/search';

  /**
   * @typedef {object} Props
   * @property {(event: MouseEvent) => void} [onclick] `click` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    onclick = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Navigate to the search results page if search terms are given, or go back the previous page.
   * @param {string} terms New search terms.
   */
  const navigate = (terms) => {
    const hadTerms = !!$searchTerms;
    const { path } = parseLocation();
    const searching = path.startsWith('/search/');

    $searchTerms = terms;

    if (terms) {
      goto(`/search/${terms}`, { replaceState: searching });
    } else if (hadTerms && searching) {
      goBack('/collections');
    }
  };

  /** @type {any | undefined} */
  let searchBar = $state();

  $effect(() => {
    // Restore search terms when the page is reloaded
    if (searchBar && $searchTerms !== searchBar?.value) {
      searchBar.value = $searchTerms;
    }
  });
</script>

<div role="none" class="wrapper">
  {#if $searchMode}
    <SearchBar
      bind:this={searchBar}
      keyShortcuts="Accel+F"
      placeholder={$_(`search_placeholder_${$searchMode}`)}
      --sui-textbox-placeholder-text-align="center"
      {onclick}
      oninput={({ target }) => {
        // @todo Implement quick search dropdown.
        navigate(/** @type {HTMLInputElement} */ (target).value.trim());
      }}
    />
  {/if}
</div>

<style lang="scss">
  .wrapper {
    display: contents;
    --sui-textbox-border-width: 0;
  }
</style>
