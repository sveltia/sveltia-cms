<script>
  /**
   * @typedef {object} Props
   * @property {import('svelte').Snippet} [primaryToolbar] Primary toolbar content.
   * @property {import('svelte').Snippet} [secondaryToolbar] Secondary toolbar content.
   * @property {import('svelte').Snippet} [mainContent] Main content.
   * @property {import('svelte').Snippet} [secondarySidebar] Secondary sidebar content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    primaryToolbar = undefined,
    secondaryToolbar = undefined,
    mainContent = undefined,
    secondarySidebar = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{@render primaryToolbar?.()}
<div role="none" class="main-inner">
  <div role="none" class="main-inner-main">
    {@render secondaryToolbar?.()}
    {@render mainContent?.()}
  </div>
  {@render secondarySidebar?.()}
</div>

<style lang="scss">
  .main-inner {
    flex: auto;
    display: flex;
    overflow: hidden;

    .main-inner-main {
      flex: auto;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    :global(.secondary-sidebar) {
      flex: none;
      overflow: auto;
      box-sizing: content-box;
      border-top-left-radius: 16px;
      width: 320px;
      background-color: var(--sui-secondary-background-color);

      :global([role='listbox']) {
        padding: 12px;
      }
    }
  }
</style>
