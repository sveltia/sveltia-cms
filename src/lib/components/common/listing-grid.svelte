<!--
  @component A wrapper of the `Grid` component that can display a list of entries, files or assets
  in a simple table or grid.
-->
<script>
  import { Grid } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  /**
   * @typedef {object} Props
   * @property {ViewType} viewType - View type.
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
      border-width: 0;
    }

    :global([role='row']) {
      display: block;
      position: relative;
      overflow: hidden;
      height: auto;
      text-align: left;

      &:focus-visible {
        outline-color: transparent;

        :global(.preview) {
          outline-offset: -2px;
          outline-width: 2px !important;
          outline-style: solid;
          outline-color: var(--sui-primary-accent-color-light);
        }
      }

      :global(.grid-cell) {
        display: block;
      }

      :global(.grid-cell.image:empty) {
        border-radius: var(--sui-control-medium-border-radius);
        background-color: var(--sui-secondary-background-color);
        aspect-ratio: 1 / 1;
      }

      :global(.checkbox) {
        position: absolute;
        inset: 8px auto auto 8px;
        z-index: 2;
      }

      :global(.title) {
        :global(span) {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          overflow: hidden;
          margin: 12px 8px 0;
          height: 40px;
          line-height: 1.5;
        }
      }
    }

    :global([role='row'][tabindex]) {
      border-radius: var(--sui-control-medium-border-radius);
      padding: 8px;
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
        outline-offset: -2px;
        outline-width: 2px !important;
        outline-style: solid;
        outline-color: transparent;
        transition-property: background-color, outline-color;
        transition-duration: 200ms;

        &:focus {
          outline-color: var(--sui-primary-accent-color-light);
        }
      }

      :global([role='row'][tabindex]) {
        cursor: pointer;
      }

      :global([role='row']:hover) {
        background-color: var(--sui-hover-background-color);
      }

      :global([role='gridcell']) {
        vertical-align: middle;
        overflow: hidden;
        text-overflow: ellipsis;
        height: 40px;
        padding: 0 8px;
        max-width: 100%;
        color: var(--sui-secondary-foreground-color);
        white-space: nowrap;

        :global(.label) {
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      :global(.grid-cell.image:empty::before) {
        display: block;
        border-radius: var(--sui-control-medium-border-radius);
        width: 40px;
        height: 40px;
        background-color: var(--sui-secondary-background-color);
        content: '';
      }

      :global([role='gridcell']:first-child) {
        padding-left: 16px;
      }

      :global([role='gridcell']:last-child) {
        padding-right: 16px;
      }

      :global([role='row'] [role='gridcell']) {
        border-width: 1px 0 0;
        border-color: var(--sui-secondary-border-color);
      }

      :global([role='row']:last-child [role='gridcell']) {
        border-width: 1px 0;
      }

      :global([role='gridcell'].checkbox) {
        width: 16px;
      }

      :global([role='gridcell'].title) {
        width: 100%; /* flex: auto */
        color: var(--sui-primary-foreground-color);
      }

      :global([role='gridcell'].image) {
        box-sizing: content-box;
        padding: 8px;
        width: 40px;
        height: 40px;
      }
    }
  }
</style>
