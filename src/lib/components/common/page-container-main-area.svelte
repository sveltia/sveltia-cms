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

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    primaryToolbar = undefined,
    secondaryToolbar = undefined,
    mainContent = undefined,
    secondarySidebar = undefined,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="group" class="wrapper" {...rest}>
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
    flex: auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: var(--sui-primary-background-color);

    &:not(:first-child) {
      border-top-left-radius: 16px;
    }

    :global {
      .sui.toolbar.primary {
        justify-content: center;

        @media (width < 768px) {
          background-color: var(--sui-secondary-background-color);
        }
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

    :global {
      .secondary-sidebar {
        flex: none;
        overflow: auto;
        box-sizing: content-box;
        width: 320px;
        background-color: var(--sui-secondary-background-color);

        @media (768px <= width) {
          border-top-left-radius: 16px;
        }

        [role='listbox'] {
          padding: 12px;
        }
      }
    }
  }
</style>
