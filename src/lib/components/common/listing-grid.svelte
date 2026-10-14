<!--
  @component A wrapper of the `Grid` component that can display a list of entries, files or assets
  in a simple table or grid.
-->
<script>
  import { Grid } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';

  /**
   * @import { Snippet } from 'svelte';
   * @import { ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {ViewType} viewType View type.
   * @property {string} [aria-label] Accessible name of the grid.
   * @property {any} [scrollKey] Value whose change scrolls the list back to the top, e.g. when the
   * items are sorted differently.
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props & Record<string, any>} */
  let {
    /* eslint-disable prefer-const */
    viewType,
    // The `Grid` component takes its accessible name as a prop; a spread `aria-label` is dropped
    'aria-label': ariaLabel = undefined,
    scrollKey = undefined,
    children = undefined,
    ...rest
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Scrolling element. A plain variable, as nothing has to react to it.
   * @type {HTMLElement | undefined}
   */
  let scroller;

  $effect(() => {
    void scrollKey;

    /* v8 ignore next -- the element is attached before the effect runs */
    if (scroller) {
      scroller.scrollTop = 0;
    }
  });
</script>

<div
  role="none"
  class="{viewType}-view"
  {@attach (element) => {
    scroller = element;
  }}
>
  {#await sleep() then}
    <Grid multiple clickToSelect={false} {ariaLabel} {...rest}>
      {@render children?.()}
    </Grid>
  {/await}
</div>

<style>
  :is(.grid-view, .list-view, .table-view) {
    display: block;
    padding: 0 16px 16px;
    height: 100%;
    overflow-y: auto;
  }

  .grid-view {
    @media (width < 768px) {
      padding: 4px;
    }

    :global {
      .row-group-caption {
        display: block;
        grid-column: 1 / -1; /* span the entire row */

        th {
          display: block;
        }
      }

      .row-group:not(:first-child) .row-group-caption {
        margin-top: 16px;
      }

      .grid-body {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(var(--grid-size, 200px), 1fr));
        gap: 16px;
        border-width: 0;

        @media (width < 768px) {
          grid-template-columns: repeat(auto-fill, minmax(var(--grid-size, 160px), 1fr));
          gap: 8px;
        }
      }

      .grid-row {
        display: block;
        position: relative;
        overflow: hidden;
        height: auto;
        text-align: start;

        .grid-cell {
          display: block;

          &.image:empty {
            aspect-ratio: 1 / 1;
          }
        }

        .checkbox {
          position: absolute;
          inset-block-start: 4px;
          inset-inline-start: 4px;
          z-index: 2;
        }

        .title {
          .label {
            overflow: hidden;
            margin: 12px;
            height: calc(var(--sui-line-height-compact) * 2);
            line-height: var(--sui-line-height-compact);
          }
        }

        /* Editorial Workflow status, shown below the title on a tile */
        .status {
          margin: -4px 12px 12px;
        }

        &[tabindex] {
          border-radius: var(--sui-control-large-border-radius);
          background-color: var(--sui-secondary-background-color);
          cursor: pointer;
          transition: background-color 200ms;

          &:is(:hover, :focus, :active) {
            background-color: var(--sui-hover-background-color);
          }
        }
      }
    }
  }

  :is(.list-view, .table-view) {
    @media (width < 768px) {
      padding: 0;
    }

    :global {
      [role='grid'] {
        @media (width < 768px) {
          width: 100%;
          --sui-focus-ring-width: 0;
        }

        .row-group {
          .row-group-caption + .grid-row {
            .grid-cell {
              border-top-width: 0 !important;
            }
          }

          .row-group-caption ~ .grid-row:last-child {
            .grid-cell {
              border-bottom-width: 0 !important;
            }
          }
        }

        .grid-row {
          transition-property: background-color, outline-color;
          transition-duration: 200ms;

          &[tabindex] {
            cursor: pointer;
          }

          &:hover {
            background-color: var(--sui-hover-background-color);
          }

          &:last-child .grid-cell {
            border-width: 1px 0;
          }
        }

        .grid-cell {
          overflow: hidden;
          border-width: 1px 0 0;
          border-color: var(--sui-secondary-border-color);
          padding: 0 16px 0 0;
          height: 40px;
          max-width: 100%;
          color: var(--sui-secondary-foreground-color);
          white-space: nowrap;
          vertical-align: middle;

          @media (width < 768px) {
            border-width: 0 !important;
            height: 64px;
          }

          &.checkbox {
            padding-inline-start: 8px !important;
            width: 44px;
          }

          &.title {
            width: 100%; /* flex: auto */
            color: var(--sui-primary-foreground-color);
          }

          /*
           * The column is as wide as the widest Editorial Workflow status badge, so align the
           * badges to the end of the row rather than letting the narrower ones float mid-column
           */

          &.status {
            text-align: end;
          }

          &:first-child {
            padding-inline-start: 16px;
          }

          .label {
            overflow: hidden;

            @media (width < 768px) {
              white-space: normal;
              line-height: var(--sui-line-height-compact);
            }
          }

          &.image {
            width: 48px;

            &:empty::before {
              display: block;
              border-radius: var(--sui-control-medium-border-radius);
              width: var(--icon-size);
              height: var(--icon-size);
              background-color: var(--sui-secondary-background-color);
              content: '';
            }
          }
        }
      }
    }
  }

  /* The table view is a list view with more columns, only shown on a large screen */
  .table-view {
    :global {
      [role='grid'] {
        /* The header row can be focused, but it doesn’t open anything */
        .grid-head .grid-row {
          cursor: default;

          &:hover {
            background-color: transparent;
          }
        }

        .grid-col-header {
          position: sticky;
          inset-block-start: 0;
          z-index: 1;
          border-bottom: 1px solid var(--sui-secondary-border-color);
          padding: 0 16px 0 0;
          height: 40px;
          background-color: var(--sui-primary-background-color);
          color: var(--sui-secondary-foreground-color);
          font-size: var(--sui-font-size-small);
          font-weight: var(--sui-font-weight-bold);
          text-align: start;
          white-space: nowrap;
          vertical-align: middle;

          &:first-child {
            padding-inline-start: 16px;
          }
        }

        /* Each column is as wide as its content, up to a limit; the text is truncated beyond */
        .grid-cell.title {
          width: auto;

          .label {
            width: max-content;
            min-width: 160px;
            max-width: 400px;
          }
        }

        .grid-cell.column .label {
          width: max-content;
          max-width: 320px;
        }

        /* The last column takes up the rest of the width, so the others are as wide as their
          content */

        :is(.grid-cell, .grid-col-header).status {
          width: 100%;
        }
      }
    }
  }
</style>
