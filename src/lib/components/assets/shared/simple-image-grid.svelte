<script>
  import { Listbox } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @typedef {object} Props
   * @property {string} [viewType] - View type.
   * @property {string} [gridId] - The `id` attribute of the inner listbox.
   * @property {boolean} [showTitle] - Whether to show the file name or title under the image while
   * in grid view.
   * @property {(detail: { value: string }) => void} [onChange] - Custom `change` event handler.
   * @property {import('svelte').Snippet} [children] - Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    viewType = 'grid',
    gridId = undefined,
    showTitle = false,
    onChange = undefined,
    children = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<div role="none" class="wrapper" class:show-title={showTitle}>
  <Listbox
    id={gridId}
    class={viewType}
    aria-label={$_('assets_dialog.available_images')}
    onChange={(event) => {
      onChange?.(event.detail);
    }}
  >
    {@render children?.()}
  </Listbox>
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    :global(.listbox) {
      gap: 4px;
      overflow-x: hidden;
      overflow-y: auto;
      border-width: 0;
      max-height: calc(100% - var(--sui-focus-ring-width) * 2);

      :global(.option) {
        :global(button) {
          border-radius: var(--sui-control-medium-border-radius);
          padding: 4px;
          width: 100%;
          height: auto;
          transition: none;

          &:focus-visible {
            outline-color: transparent;
          }

          :global(.preview) {
            flex: none;
            border-radius: var(--sui-control-medium-border-radius);
            aspect-ratio: 1 / 1;
            object-fit: contain;
          }
        }

        :global(button[aria-selected='true']) {
          :global(.icon) {
            display: none;
          }
        }
      }

      :global(.name) {
        display: -webkit-box;
        min-height: calc(var(--sui-font-size-default) * 2);
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        overflow: hidden;
        white-space: normal;
        line-height: var(--sui-line-height-compact);
      }
    }

    :global(.listbox.grid) {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      height: auto;
      max-height: none;

      :global(.option) {
        :global(button) {
          flex-direction: column;
          justify-content: flex-start;

          :global(.preview) {
            width: 100%;
            height: auto;
          }

          :global(.name) {
            flex: none;
            padding: 4px;
            width: 100%;
            min-height: calc(var(--sui-font-size-default) * 3);
            color: var(--sui-secondary-foreground-color);
          }
        }
      }

      :global(button[aria-selected='true']) {
        :global(.preview) {
          outline-offset: -2px;
          outline-width: 2px !important;
          outline-style: solid;
          outline-color: var(--sui-primary-accent-color-light);
        }
      }
    }

    &:not(.wrapper.show-title) :global(.listbox.grid .option .name) {
      position: absolute;
      left: -99999px;
    }

    :global(.listbox.list) {
      :global(.option) {
        :global(button) {
          gap: 16px;

          :global(.preview) {
            width: 64px;
          }

          :global(.name) {
            flex: auto;
          }
        }

        :global(button[aria-selected='true']) {
          outline-offset: -2px;
          outline-width: 2px !important;
          outline-style: solid;
          outline-color: var(--sui-primary-accent-color-light);
        }
      }
    }
  }
</style>
