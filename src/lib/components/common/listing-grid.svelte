<!--
  @component A wrapper of the `Grid` component that can display a list of entries, files or assets
  in a simple table or grid.
-->
<script>
  import { Grid } from '@sveltia/ui';

  /**
   * View type.
   * @type {ViewType}
   */
  export let viewType;
</script>

<div role="none" class="{viewType}-view">
  <Grid multiple {...$$restProps}>
    <slot />
  </Grid>
</div>

<style lang="scss">
  .grid-view {
    display: contents;

    :global(.row-group-caption) {
      display: block;
      grid-column: 1 / -1; // span the entire row

      :global(th) {
        display: block;
      }
    }

    :global(.row-group:not(:first-child)) {
      margin: 16px 0 0;
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
      padding: 0;
      height: auto;
      text-align: left;
      cursor: pointer;

      &:focus-visible {
        outline-color: transparent;

        :global(.preview) {
          outline-offset: -2px;
          outline-width: 2px;
          outline-style: solid;
          outline-color: var(--sui-primary-accent-color-light);
        }
      }

      :global(.grid-cell) {
        display: block;
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
          overflow: hidden;
          margin: 12px 8px 0;
          height: 40px;
          line-height: 1.5;
        }
      }
    }
  }

  .list-view {
    display: contents;

    :global([role='grid']) {
      :global(.row-group) {
        :global(.row-group-caption ~ .grid-row:first-of-type) {
          :global(.grid-cell) {
            border-top-width: 0 !important;
          }
        }

        :global(.row-group-caption ~ .grid-row:last-of-type) {
          :global(.grid-cell) {
            border-bottom-width: 0 !important;
          }
        }
      }

      :global([role='row']) {
        cursor: pointer;
        transition: all 200ms;
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
        padding: 8px;
      }
    }
  }
</style>
