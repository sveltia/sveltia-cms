<script>
  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {Snippet} [primaryToolbar] Primary toolbar content.
   * @property {Snippet} [secondaryToolbar] Secondary toolbar content.
   * @property {Snippet} [mainContent] Main content.
   * @property {Snippet} [secondarySidebar] Secondary sidebar content.
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

<div role="none" class="wrapper">
  {@render primaryToolbar?.()}
  <div role="none" class="main-inner">
    <div role="none" class="main-inner-main">
      {@render secondaryToolbar?.()}
      {@render mainContent?.()}
    </div>
    {@render secondarySidebar?.()}
  </div>
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    :global(.sui.toolbar.primary) {
      @media (width < 768px) {
        background-color: var(--sui-secondary-background-color);
      }
    }
  }

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
      width: 320px;
      background-color: var(--sui-secondary-background-color);

      @media (768px <= width) {
        border-top-left-radius: 16px;
      }

      :global([role='listbox']) {
        padding: 12px;
      }
    }
  }
</style>
