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
   * @property {Snippet} [children] Slot content.
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
  :is(.grid-view, .list-view) {
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
        margin: 8px;
        grid-column: 1 / -1; // span the entire row

        th {
          display: block;
        }
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
        text-align: left;

        .grid-cell {
          display: block;

          &.image:empty {
            aspect-ratio: 1 / 1;
          }
        }

        .checkbox {
          position: absolute;
          inset: 4px auto auto 4px;
          z-index: 2;
        }

        .title {
          .label {
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

  .list-view {
    --icon-size: 36px;

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

        [role='rowheader'] {
          border-width: 0;
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
            padding-left: 8px;
            width: 44px;
          }

          &.title {
            width: 100%; /* flex: auto */
            color: var(--sui-primary-foreground-color);
          }

          &:first-child {
            padding-left: 16px;
          }

          .label {
            overflow: hidden;
            text-overflow: ellipsis;

            @media (width < 768px) {
              display: -webkit-box;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 2;
              line-clamp: 2;
              white-space: normal;
              line-height: var(--sui-line-height-compact);
              word-break: break-all;
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
</style>
