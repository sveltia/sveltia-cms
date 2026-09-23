<!--
  @component
  Subfolders of the folder being browsed in the asset picker, listed ahead of the assets. Like the
  assets below, they’re options in a list box, which the arrow keys move through. A folder is opened
  with a click or the Enter key. When a folder is to be picked instead of files, a click or the
  Space key selects a folder instead, and a double click or the Enter key opens it, like in a file
  manager.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, Listbox, Option } from '@sveltia/ui';

  import { keepFocusIn } from '$lib/services/app/focus';

  /**
   * @import { AssetSubfolder, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {AssetSubfolder[]} subfolders Subfolders.
   * @property {ViewType} [viewType] View type, which lays the folders out in a grid or a column.
   * @property {(subfolder: AssetSubfolder) => void} [onOpen] Called when a subfolder is opened.
   * @property {boolean} [multiple] Whether more than one subfolder can be selected.
   * @property {string[]} [selectedPaths] Paths of the selected subfolders.
   * @property {(subfolder: AssetSubfolder, selected: boolean) => void} [onSelect] Called with a
   * subfolder and whether it’s now selected. Given only when a folder is to be picked, which makes
   * a click select a folder rather than open it.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    subfolders,
    viewType = 'grid',
    onOpen = undefined,
    multiple = false,
    selectedPaths = [],
    onSelect = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  /**
   * Whether the subfolder being clicked was selected before the click. It’s read in the capture
   * phase, before the list box handles the click.
   */
  let wasSelected = false;

  /**
   * Open a subfolder. The folders are replaced with those of the subfolder, or removed if it has
   * none, taking the focus with them, so it’s kept within the closest `data-focus-scope`
   * container, like the content pane of the Select Assets dialog, if the folders had it.
   * @param {AssetSubfolder} subfolder Subfolder.
   */
  const open = (subfolder) => {
    const focusScope = wrapper?.closest('[data-focus-scope]');
    const hadFocus = !!wrapper?.contains(document.activeElement);

    onOpen?.(subfolder);

    if (hadFocus && focusScope instanceof HTMLElement) {
      keepFocusIn(focusScope);
    }
  };

  /**
   * Handle a click on a subfolder: open it, or, when folders can be selected, clear the selection
   * of a selected folder in a single selection. The list box selects the folder clicked, and
   * toggles it in a multiple selection, but it has no way to clear a single selection. This runs
   * once the list box has handled the click: the handler is delegated to the document root.
   * @param {MouseEvent} event Click event.
   * @param {AssetSubfolder} subfolder Subfolder.
   */
  const onClick = (event, subfolder) => {
    if (!onSelect) {
      open(subfolder);

      return;
    }

    // The second click of a double click, which opens the folder, leaves the selection as is
    if (!multiple && event.detail === 1 && wasSelected) {
      onSelect(subfolder, false);
    }
  };

  /**
   * Open the subfolder under the list box cursor with the Enter key when folders can be selected.
   * The list box would otherwise click it, selecting it or toggling its selection, which the Space
   * key already does.
   * @param {KeyboardEvent} event Keyboard event.
   */
  const onKeyDown = (event) => {
    if (!onSelect || event.key !== 'Enter') {
      return;
    }

    const path = wrapper?.querySelector('[role="option"].focused')?.getAttribute('data-value');
    const subfolder = subfolders.find((s) => s.path === path);

    if (subfolder) {
      event.preventDefault();
      event.stopPropagation();
      open(subfolder);
    }
  };
</script>

<!-- A folder that is only opened isn’t marked as selected, so the check mark is left out -->
{#snippet noCheckIcon()}{/snippet}

<div role="none" class="wrapper" bind:this={wrapper} onkeydowncapture={onKeyDown}>
  <Listbox class="subfolders {viewType}" multiple={!!onSelect && multiple} ariaLabel={_('folders')}>
    {#each subfolders as subfolder (subfolder.path)}
      <Option
        label={subfolder.name}
        value={subfolder.path}
        selected={!!onSelect && selectedPaths.includes(subfolder.path)}
        aria-description={_('folder')}
        checkIcon={onSelect ? undefined : noCheckIcon}
        onChange={(/** @type {CustomEvent} */ event) => {
          onSelect?.(subfolder, event.detail.selected);
        }}
        onclickcapture={() => {
          wasSelected = selectedPaths.includes(subfolder.path);
        }}
        onclick={(/** @type {MouseEvent} */ event) => {
          onClick(event, subfolder);
        }}
        ondblclick={() => {
          if (onSelect) {
            open(subfolder);
          }
        }}
      >
        {#snippet startIcon()}
          <Icon name="folder" />
        {/snippet}
      </Option>
    {/each}
  </Listbox>
</div>

<style>
  .wrapper {
    display: contents;

    :global {
      .listbox.subfolders {
        gap: 4px;
        margin-bottom: 8px;
        border-width: 0;
        padding: 0;
        min-width: 0;
        background-color: transparent;

        &.grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        }

        .option button {
          border-radius: var(--sui-control-medium-border-radius);
          min-width: 0;
          height: 40px;

          .label {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }
  }
</style>
