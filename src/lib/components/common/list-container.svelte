<!--
  @component A container for the entry list or asset list.
-->
<script>
  import { Group } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {import('svelte').Snippet} [children] - Slot content.
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
        height: 100%;
        overflow-y: auto;
      }

      :global(.grid-view) {
        padding: 4px;
      }

      :global(.list-view) {
        padding: 12px;
      }
    }
  }
</style>
