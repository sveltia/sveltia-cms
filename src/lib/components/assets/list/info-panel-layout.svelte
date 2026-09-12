<!--
  @component
  Layout of the asset info panel, shared by repository assets and assets on external locations: an
  optional preview followed by sections with a heading and a value.
-->
<script>
  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {Snippet} [preview] Media preview.
   * @property {Snippet} children Sections.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    preview = undefined,
    children,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="none" class="detail">
  {#if preview}
    <div role="none" class="preview">
      {@render preview()}
    </div>
  {/if}
  {@render children()}
</div>

<style>
  .detail {
    flex: none;
    overflow-x: hidden;
    overflow-y: auto;
    padding: 16px;
    width: 320px;

    .preview {
      overflow: hidden;
      margin: 0 0 16px;
      border-radius: var(--sui-control-large-border-radius);
      background-color: var(--sui-content-background-color);
      aspect-ratio: 1 / 1;
    }

    :global {
      section {
        &:not(:last-child) {
          margin: 0 0 16px;
        }

        & > * {
          margin: 0 0 4px;
          word-break: break-all;
        }
      }

      h4 {
        font-size: var(--sui-font-size-small);
        font-weight: var(--sui-font-weight-bold);
        color: var(--sui-secondary-foreground-color);
      }
    }
  }
</style>
