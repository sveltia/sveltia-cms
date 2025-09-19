<script>
  import { Icon, Option } from '@sveltia/ui';

  /**
   * @import { Snippet } from 'svelte';
   * @import { ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} value The `value` attribute of the option.
   * @property {boolean} selected Whether the option is selected.
   * @property {ViewType} [viewType] View type.
   * @property {boolean} multiple Whether to allow selecting multiple assets.
   * @property {(event: CustomEvent) => void} onChange Custom `Change` event handler.
   * @property {Snippet} children Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    value,
    selected,
    viewType = 'grid',
    multiple,
    onChange,
    children,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="none" class="wrapper {viewType}">
  <Option label="" {value} {selected} {onChange}>
    {#snippet startIcon()}
      {#if multiple}
        <span role="none" class="icon check-background">
          <Icon name="check" class="icon check" />
        </span>
      {/if}
    {/snippet}
    {@render children?.()}
  </Option>
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    :global {
      [role='option'] {
        position: relative;

        & > .icon.check {
          display: none;
        }

        &[aria-selected='false'] {
          .check-background {
            border-color: var(--sui-checkbox-border-color);
            background-color: var(--sui-checkbox-background-color);

            .icon {
              display: none;
            }
          }
        }

        &[aria-selected='true'] {
          .check-background {
            border-color: var(--sui-primary-accent-color);
            color: var(--sui-primary-accent-color-inverted);
            background-color: var(--sui-primary-accent-color);
          }
        }

        .check-background {
          display: flex;
          justify-content: center;
          align-items: center;
          border-width: 1px;
          border-radius: var(--sui-checkbox-border-radius);
          width: 20px;
          height: 20px;
          pointer-events: none;

          .icon {
            color: inherit !important;
            font-size: 20px;
          }
        }
      }
    }

    &.grid {
      :global {
        .check-background {
          position: absolute;
          inset-block-start: 8px;
          inset-inline-start: 8px;
          z-index: 1;
        }
      }
    }

    &.list {
      :global {
        .check-background {
          margin-inline-start: 16px;
        }
      }
    }
  }
</style>
