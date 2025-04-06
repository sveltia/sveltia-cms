<!--
  @component A container for the entry list or asset list.
-->
<script>
  import { Group } from '@sveltia/ui';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    children = undefined,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="none" class="list-container">
  <Group {...rest}>
    {@render children?.()}
  </Group>
</div>

<style lang="scss">
  .list-container {
    flex: auto;
    position: relative;
    height: 100%;
    overflow: hidden;

    & > :global(.group) {
      height: 100%;
      overflow-y: auto;
      overscroll-behavior-y: contain;

      :global(:is(.grid-view, .list-view)) {
        display: block;
        padding: 0 16px 16px;
        height: 100%;
        overflow-y: auto;

        @media (width < 768px) {
          padding: 4px;
        }
      }
    }
  }
</style>
