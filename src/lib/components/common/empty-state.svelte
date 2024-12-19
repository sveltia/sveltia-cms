<script>
  /**
   * @typedef {object} Props
   * @property {import('svelte').Snippet} [children] - Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    children = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="none" class="empty">
  {@render children?.()}
</div>

<style lang="scss">
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px;
    width: 100%;
    height: 100%;
    text-align: center;
  }
</style>
