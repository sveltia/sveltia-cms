<script>
  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    children = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="none" class="wrapper">
  {@render children?.()}
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    @media (width < 768px) {
      display: block;
      position: fixed;
      inset: auto 16px 72px auto;
      z-index: 100;

      :global {
        button {
          border-radius: 50%;
          height: 56px;
          box-shadow: 0 4px 8px #0006;

          .icon {
            font-size: 32px;
          }
        }
      }
    }
  }
</style>
