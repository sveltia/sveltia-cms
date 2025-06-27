<!--
  @component A container for the entry list or asset list.
-->
<script>
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

<div role="group" class="list-container" {...rest}>
  {@render children?.()}
</div>

<style lang="scss">
  .list-container {
    --icon-size: 36px;

    flex: auto;
    position: relative;
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
  }
</style>
