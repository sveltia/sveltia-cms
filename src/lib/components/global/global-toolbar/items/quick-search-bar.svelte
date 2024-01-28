<script>
  import { SearchBar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { selectedCollection } from '$lib/services/contents';
  import { goBack, goto, parseLocation } from '$lib/services/navigation';
  import { searchTerms } from '$lib/services/search';

  /**
   * Navigate to the search results page if search terms are given, or go back the previous page.
   * @param {string} terms - New search terms.
   */
  const navigate = (terms) => {
    const hadTerms = !!$searchTerms;
    const { path } = parseLocation();
    const searching = path.startsWith('/search/');

    $searchTerms = terms;

    if (terms) {
      goto(`/search/${terms}`, { replaceState: searching });
    } else if (hadTerms && searching) {
      goBack(`/collections/${$selectedCollection.name}`);
    }
  };

  /**
   * @type {HTMLElement}
   */
  let wrapper;
  /**
   * @type {SearchBar}
   */
  let searchBar;

  $: {
    // Restore search terms when the page is reloaded
    if (searchBar && $searchTerms !== searchBar?.value) {
      searchBar.value = $searchTerms;
    }
  }
</script>

<div role="none" class="wrapper" bind:this={wrapper}>
  <SearchBar
    bind:this={searchBar}
    keyShortcuts="Accel+F"
    showInlineLabel={true}
    aria-label={$_('search_placeholder')}
    --sui-textbox-placeholder-text-align="center"
    on:input={({ target }) => {
      // @todo Implement quick search dropdown.
      navigate(/** @type {HTMLInputElement} */ (target).value.trim());
    }}
  />
</div>

<style lang="scss">
  .wrapper {
    display: contents;
  }
</style>
