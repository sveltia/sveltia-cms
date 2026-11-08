<script>
  import { _ } from '@sveltia/i18n';
  import { Listbox } from '@sveltia/ui';

  /**
   * @import { Snippet } from 'svelte';
   * @import { MediaLibraryAssetKind } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} [viewType] View type.
   * @property {string} [gridId] The `id` attribute of the inner listbox.
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {MediaLibraryAssetKind} [kind] Kind of the listed assets, which names the list:
   * images, or files of any kind if `undefined`.
   * @property {(detail: { value: string }) => void} [onChange] Custom `change` event handler.
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props} */
  let {
    viewType = 'grid',
    gridId = undefined,
    multiple = false,
    kind = undefined,
    onChange = undefined,
    children = undefined,
  } = $props();
</script>

<div role="none" class="wrapper">
  <Listbox
    id={gridId}
    class={viewType}
    {multiple}
    ariaLabel={_(`assets_dialog.available_${kind === 'image' ? 'images' : 'files'}`)}
    onChange={(event) => {
      onChange?.(event.detail);
    }}
  >
    {@render children?.()}
  </Listbox>
</div>

<style>
  .wrapper {
    display: contents;

    :global {
      .listbox {
        gap: 4px;
        border-width: 0;

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

              &:empty {
                display: none;
              }
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
