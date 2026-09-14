<script>
  import { _ } from '@sveltia/i18n';
  import { SearchBar } from '@sveltia/ui';
  import { untrack } from 'svelte';

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
    const hadTerms = !!searchTerms.current;
    const { path } = parseLocation();
    const searching = path.startsWith('/search/');

    searchTerms.current = terms;

    if (terms) {
      goto(`/search/${terms}`, { replaceState: searching });
    } else if (hadTerms && searching) {
      goBack('/collections');
    }
  };

  let inputValue = $state('');

  $effect(() => {
    const terms = searchTerms.current;

    // Restore the search terms when the page is reloaded, or another page changes them. The input
    // is left alone while it only differs by surrounding spaces, which the terms don’t keep
    untrack(() => {
      if (terms !== inputValue.trim()) {
        inputValue = terms;
      }
    });
  });
</script>

<div role="none" class="wrapper">
  {#if searchMode.current}
    <SearchBar
      bind:value={inputValue}
      debounce
      keyShortcuts="Accel+F"
      placeholder={_(`search_placeholder_${searchMode.current}`)}
      --sui-textbox-placeholder-text-align="center"
      {onclick}
      oninput={({ target }) => {
        // @todo Implement quick search dropdown.
        navigate(/** @type {HTMLInputElement} */ (target).value.trim());
      }}
      onClear={() => {
        navigate('');
      }}
    />
  {/if}
</div>

<style>
  .wrapper {
    display: contents;
    --sui-textbox-border-width: 0;
  }
</style>
