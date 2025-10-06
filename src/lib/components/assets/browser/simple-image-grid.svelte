<script>
  import { Listbox } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} [viewType] View type.
   * @property {string} [gridId] The `id` attribute of the inner listbox.
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {boolean} [showTitle] Whether to show the file name or title under the image while in
   * grid view.
   * @property {(detail: { value: string }) => void} [onChange] Custom `change` event handler.
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    viewType = 'grid',
    gridId = undefined,
    multiple = false,
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
    {multiple}
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

    :global {
      .listbox {
        gap: 4px;
        overflow-x: hidden;
        overflow-y: auto;
        border-width: 0;
        max-height: calc(100% - var(--sui-focus-ring-width) * 2);

        .option {
          button {
            border-radius: var(--sui-control-medium-border-radius);
            padding: 4px;
            width: 100%;
            height: auto;
            transition: none;

            &:focus-visible {
              outline-color: transparent;
            }

            .preview {
              flex: none;
              border-radius: var(--sui-control-medium-border-radius);
              aspect-ratio: 1 / 1;
              object-fit: contain;
            }
          }
        }

        .name {
          min-height: calc(var(--sui-font-size-default) * 2);
          white-space: normal;
          line-height: var(--sui-line-height-compact);
        }
      }

      .listbox.grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        height: auto;
        max-height: none;

        .option {
          button {
            flex-direction: column;
            justify-content: flex-start;

            .preview {
              width: 100%;
              height: auto;
            }

            .name {
              flex: none;
              margin: 4px 0 12px;
              padding: 0 8px;
              width: 100%;
              min-height: calc(var(--sui-font-size-default) * 3);
            }
          }
        }

        button[aria-selected='true'] {
          outline-offset: -2px;
          outline-width: 2px !important;
          outline-style: solid;
          outline-color: var(--sui-primary-accent-color-light);
        }
      }

      &:not(.wrapper.show-title) .listbox.grid .option .name {
        position: absolute;
        inset-inline-start: -99999px;
      }

      .listbox.list {
        .option {
          button {
            gap: 16px;

            .preview {
              width: 64px;
            }

            .name {
              flex: auto;
              padding-inline: 0 8px;
            }
          }

          button[aria-selected='true'] {
            outline-offset: -2px;
            outline-width: 2px !important;
            outline-style: solid;
            outline-color: var(--sui-primary-accent-color-light);
          }
        }
      }
    }
  }
</style>
