<!--
  @component A wrapper of the `Grid` component that can display a list of entries, files or assets
  in a simple table or grid.
-->
<script>
  import { Grid } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  /**
   * @typedef {object} Props
   * @property {import('$lib/typedefs').ViewType} viewType - View type.
   * @property {import('svelte').Snippet} [children] - Slot content.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    viewType,
    children = undefined,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="none" class="{viewType}-view">
  {#await sleep(0) then}
    <Grid multiple clickToSelect={false} {...rest}>
      {@render children?.()}
    </Grid>
  {/await}
</div>

<style lang="scss">
  .grid-view {
    :global(.row-group-caption) {
      display: block;
      margin: 8px;
      grid-column: 1 / -1; // span the entire row

      :global(th) {
        display: block;
      }
    }

    :global(.grid-body) {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(var(--grid-size, 200px), 1fr));
      gap: 16px;
      border-width: 0;
    }

    :global([role='row']) {
      display: block;
      position: relative;
      overflow: hidden;
      height: auto;
      text-align: left;

      :global(.grid-cell) {
        display: block;
      }

      :global(.grid-cell.image:empty) {
        aspect-ratio: 1 / 1;
      }

      :global(.checkbox) {
        position: absolute;
        inset: 4px auto auto 4px;
        z-index: 2;
      }

      :global(.title) {
        :global(span) {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          overflow: hidden;
          margin: 12px;
          height: 40px;
          line-height: 1.5;
          word-break: break-all;
        }
      }
    }

    :global([role='row'][tabindex]) {
      border-radius: var(--sui-control-large-border-radius);
      background-color: var(--sui-secondary-background-color);
      cursor: pointer;
      transition: background-color 200ms;

      &:hover,
      &:focus,
      &:active {
        background-color: var(--sui-hover-background-color);
      }
    }
  }

  .list-view {
    --icon-size: 36px;

    :global([role='grid']) {
      :global(.row-group) {
        :global(.row-group-caption + .grid-row) {
          :global(.grid-cell) {
            border-top-width: 0 !important;
          }
        }

        :global(.row-group-caption ~ .grid-row:last-child) {
          :global(.grid-cell) {
            border-bottom-width: 0 !important;
          }
        }
      }

      :global([role='row']) {
        transition-property: background-color, outline-color;
        transition-duration: 200ms;
      }

      :global([role='row'][tabindex]) {
        cursor: pointer;
      }

      :global([role='row']:hover) {
        background-color: var(--sui-hover-background-color);
      }

      :global([role='rowheader']) {
        border-width: 0;
      }

      :global([role='gridcell']) {
        overflow: hidden;
        padding: 0 16px 0 0;
        height: 40px;
        max-width: 100%;
        color: var(--sui-secondary-foreground-color);
        white-space: nowrap;
        text-overflow: ellipsis;
        vertical-align: middle;

        &:first-child {
          padding-left: 16px;
        }

        :global(.label) {
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      :global(.grid-cell.image:empty::before) {
        display: block;
        border-radius: var(--sui-control-medium-border-radius);
        width: var(--icon-size);
        height: var(--icon-size);
        background-color: var(--sui-secondary-background-color);
        content: '';
      }

      :global([role='row'] [role='gridcell']) {
        border-width: 1px 0 0;
        border-color: var(--sui-secondary-border-color);
      }

      :global([role='row']:last-child [role='gridcell']) {
        border-width: 1px 0;
      }

      :global([role='gridcell'].checkbox) {
        padding-left: 8px;
        width: 44px;
      }

      :global([role='gridcell'].title) {
        width: 100%; /* flex: auto */
        color: var(--sui-primary-foreground-color);
      }

      :global([role='gridcell'].image) {
        width: 48px;
      }
    }
  }
</style>
