<script>
  import { waitForVisibility } from '@sveltia/utils/element';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {Snippet} children Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    children,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLElement | null} */
  let placeholder = $state(null);
  /** @type {boolean} */
  let visible = $state(false);

  $effect(() => {
    if (placeholder) {
      (async () => {
        await waitForVisibility(placeholder);
        visible = true;
      })();
    }
  });
</script>

{#if visible}
  {@render children()}
{:else}
  <div class="placeholder" bind:this={placeholder}></div>
{/if}

<style lang="scss">
  .placeholder {
    height: 64px;
  }
</style>
