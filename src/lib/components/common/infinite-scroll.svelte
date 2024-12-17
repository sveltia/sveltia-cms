<!--
  @component Enable infinite scroll for list items for better rendering performance.
  @see https://svelte.dev/docs/svelte/v5-migration-guide#Snippets-instead-of-slots-Passing-data-back-up
-->
<script>
  /**
   * @typedef {object} Props
   * @property {any[]} items - Item list.
   * @property {string} itemKey - Item key used for the `each` loop.
   * @property {number} [itemChunkSize] - Number of items to be loaded at once.
   * @property {import('svelte').Snippet<[any]>} renderItem - Snippet to render each item.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    items,
    itemKey,
    itemChunkSize = 25,
    renderItem,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * @type {number}
   */
  let loadedItemSize = $state(itemChunkSize);

  /**
   * @type {HTMLElement | undefined}
   */
  let spinner = $state(undefined);

  const loading = $derived(items.length > loadedItemSize);

  const observer = new IntersectionObserver(([{ isIntersecting }]) => {
    if (isIntersecting) {
      if (loading) {
        loadedItemSize += itemChunkSize;
      } else {
        observer.disconnect();
      }
    }
  });

  $effect(() => {
    if (spinner) {
      observer.observe(spinner);
    }
  });
</script>

{#each items.slice(0, loadedItemSize) as item (item[itemKey])}
  {@render renderItem(item)}
{/each}

{#if loading}
  <div role="none" class="spinner" bind:this={spinner}></div>
{/if}

<style>
  .spinner {
    height: 1px;
  }
</style>
