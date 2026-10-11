<script>
  import { _ } from '@sveltia/i18n';
  import { SearchBar } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import { searchMode, searchTerms } from '$lib/services/search';
  import { resetSearchAfterLeaving, updateSearchTerms } from '$lib/services/search/input';

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

<svelte:window
  onhashchange={() => {
    resetSearchAfterLeaving();
  }}
/>

<div role="none" class="wrapper">
  {#if searchMode.current}
    <SearchBar
      bind:value={inputValue}
      debounce
      keyShortcuts="Accel+F"
      placeholder={_(`search_placeholder_${searchMode.current}`)}
      aria-label={_(`search_placeholder_${searchMode.current}`)}
      --sui-textbox-placeholder-text-align="center"
      {onclick}
      oninput={({ target }) => {
        // @todo Implement quick search dropdown.
        updateSearchTerms(/** @type {HTMLInputElement} */ (target).value.trim());
      }}
      onClear={() => {
        updateSearchTerms('');
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
