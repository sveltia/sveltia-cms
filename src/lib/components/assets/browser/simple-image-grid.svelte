<!--
  @component
  Assets listed in the asset picker, in a grid or a list, along with the subfolders of the folder
  being browsed, if any. The assets are rendered lazily as they’re scrolled into view.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { InfiniteScroll, Listbox } from '@sveltia/ui';

  import SubfolderStrip from '$lib/components/assets/browser/subfolder-strip.svelte';

  /**
   * @import { Snippet } from 'svelte';
   * @import { AssetSubfolder, MediaLibraryAssetKind, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {ViewType} [viewType] View type.
   * @property {string} [gridId] The `id` attribute of the inner listbox.
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {MediaLibraryAssetKind} [kind] Kind of the listed assets, which names the list:
   * images, or files of any kind if `undefined`.
   * @property {AssetSubfolder[]} [subfolders] Subfolders of the folder being browsed, listed ahead
   * of the assets.
   * @property {(subfolder: AssetSubfolder) => void} [onOpenSubfolder] Called when a subfolder is
   * opened.
   * @property {string[]} [selectedSubfolderPaths] Paths of the selected subfolders.
   * @property {(subfolder: AssetSubfolder, selected: boolean) => void} [onSelectSubfolder] Called
   * with a subfolder and whether it’s now selected, when a folder is to be picked.
   * @property {any[]} items Listed items.
   * @property {string} itemKey Name of the item property that identifies each item.
   * @property {Snippet<[any]>} renderItem Snippet rendering an item, as a `SimpleImageGridItem`.
   */

  /** @type {Props} */
  let {
    viewType = 'grid',
    gridId = undefined,
    multiple = false,
    kind = undefined,
    subfolders = [],
    onOpenSubfolder = undefined,
    selectedSubfolderPaths = [],
    onSelectSubfolder = undefined,
    items,
    itemKey,
    renderItem,
  } = $props();
</script>

{#if subfolders.length}
  <SubfolderStrip
    {subfolders}
    {viewType}
    {multiple}
    onOpen={onOpenSubfolder}
    selectedPaths={selectedSubfolderPaths}
    onSelect={onSelectSubfolder}
  />
{/if}
<!-- An empty list box would only be a stop for the Tab key, with nothing to move through -->
{#if items.length}
  <div role="none" class="wrapper">
    <Listbox
      id={gridId}
      class={viewType}
      {multiple}
      ariaLabel={_(`assets_dialog.available_${kind === 'image' ? 'images' : 'files'}`)}
    >
      <InfiniteScroll {items} {itemKey} {renderItem} />
    </Listbox>
  </div>
{/if}

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
