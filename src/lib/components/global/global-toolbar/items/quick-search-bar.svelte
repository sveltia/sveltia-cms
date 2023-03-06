<script>
  import { SearchBar } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { selectedCollection } from '$lib/services/contents';
  import { goBack, goto, parseLocation } from '$lib/services/navigation';
  import { searchTerms } from '$lib/services/search';
  import { isMac, matchShortcut } from '$lib/services/utils/events';

  /**
   * Navigate to the search results page if search terms are given, or go back the previous page.
   *
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
      goBack(`/collections/${$selectedCollection.name}`);
    }
  };

  const focusShortcut = isMac ? 'Meta+F' : 'Ctrl+F';
  let searchBar;

  $: {
    // Restore search terms when the page is reloaded
    if (searchBar && $searchTerms !== searchBar?.value) {
      searchBar.value = $searchTerms;
    }
  }
</script>

<svelte:window
  on:keydown={(event) => {
    if (matchShortcut(event, focusShortcut)) {
      event.preventDefault();
      searchBar.focus();
    }
  }}
/>

<SearchBar
  bind:this={searchBar}
  aria-label={$_('search_placeholder')}
  aria-keyshortcuts={focusShortcut}
  --input-label-align="center"
  on:input={({ target }) => {
    // @todo Implement quick search dropdown.
    navigate(target.value.trim());
  }}
/>
