<!--
  @component
  A row or tile for a subfolder in the asset list, shown ahead of the assets, shared by repository
  folders and cloud storage services. Opening it browses the folder in place of the current one,
  and a menu offers to rename or delete the folder when the caller can do either.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { GridCell, GridRow, Icon, Menu, MenuButton, MenuItem, TruncatedText } from '@sveltia/ui';

  import { opensOnClick } from '$lib/services/user/env.svelte';

  /**
   * @import { AssetSubfolder, ViewType } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {AssetSubfolder} subfolder Subfolder.
   * @property {number} rowIndex 0-based index of the subfolder in the list, for `aria-rowindex`.
   * @property {ViewType} viewType View type.
   * @property {boolean} [hasCheckboxColumn] Whether the asset rows have a checkbox column in the
   * list view, which the folder row keeps aligned with by an empty cell.
   * @property {() => void} onOpen Called when the folder is opened.
   * @property {() => void} [onFocus] Called when the row is focused, to show the folder’s info.
   * @property {() => void} [onRename] Called from the menu to rename the folder. The menu is shown
   * only when this or `onDelete` is given.
   * @property {() => void} [onDelete] Called from the menu to delete the folder.
   * @property {boolean} [actionsDisabled] Whether the rename and delete actions are disabled.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    subfolder,
    rowIndex,
    viewType,
    hasCheckboxColumn = false,
    onOpen,
    onFocus = undefined,
    onRename = undefined,
    onDelete = undefined,
    actionsDisabled = false,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Keep a click on the menu from reaching the row, where it would open the folder.
   * @param {Event} event `click` or `dblclick` event.
   */
  const stopPropagation = (event) => {
    event.stopPropagation();
  };
</script>

<GridRow
  class="subfolder"
  aria-rowindex={rowIndex + 1}
  aria-label={subfolder.name}
  aria-description={_('folder')}
  onfocus={() => {
    onFocus?.();
  }}
  onclick={(/** @type {MouseEvent} */ event) => {
    if (opensOnClick(event)) {
      onOpen();
    }
  }}
  ondblclick={onOpen}
>
  {#if viewType === 'list' && hasCheckboxColumn}
    <!-- Keep the columns aligned with the asset rows, which have a checkbox here -->
    <GridCell class="checkbox"></GridCell>
  {/if}
  <GridCell class="image">
    <div role="none" class="preview">
      <Icon name="folder" />
    </div>
  </GridCell>
  <!--
    Unlike an image, a folder icon says nothing about the folder, so the name is always shown. The
    menu shares the cell, so the row has the same columns as an asset row in the list view
  -->
  <GridCell class="title">
    <div role="none" class="title-inner">
      <div role="none" class="label">
        <TruncatedText lines={viewType === 'list' ? 1 : 2}>
          <bdi>{subfolder.name}</bdi>
        </TruncatedText>
      </div>
      {#if onRename || onDelete}
        <div role="none" class="menu" onclick={stopPropagation} ondblclick={stopPropagation}>
          <MenuButton
            variant="ghost"
            iconic
            size="small"
            popupPosition="bottom-right"
            aria-label={_('show_folder_options')}
          >
            {#snippet popup()}
              <Menu ariaLabel={_('folder_options')}>
                {#if onRename}
                  <MenuItem
                    variant="ghost"
                    label={_('rename')}
                    aria-label={_('rename_folder')}
                    disabled={actionsDisabled}
                    onclick={onRename}
                  />
                {/if}
                {#if onDelete}
                  <MenuItem
                    variant="ghost"
                    label={_('delete')}
                    aria-label={_('delete_folder')}
                    disabled={actionsDisabled}
                    onclick={onDelete}
                  />
                {/if}
              </Menu>
            {/snippet}
          </MenuButton>
        </div>
      {/if}
    </div>
  </GridCell>
</GridRow>

<style>
  .preview {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--sui-secondary-foreground-color);

    :global(.sui.icon) {
      font-size: 24px;
    }
  }

  .title-inner {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .label {
    flex: auto;
    min-width: 0;
    word-break: break-all;
  }

  .menu {
    flex: none;
  }

  :global {
    /* A folder is a compact tile in the grid view, with the icon, the name and the menu in a row,
    unlike an asset, which needs the room for its thumbnail. The selectors are specific enough to
    win over the tile styles of the listing grid */

    .grid-view .grid-body .grid-row.subfolder {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 8px 8px 16px;

      .grid-cell.image {
        flex: none;
        display: flex;
        aspect-ratio: auto;
      }

      .grid-cell.title {
        flex: auto;
        min-width: 0;

        .label {
          margin: 0;
          height: auto;
        }
      }
    }

    .list-view .grid-body .grid-row.subfolder {
      /* The icon sits in a box the size of an asset thumbnail, so the two line up */
      .preview {
        width: var(--icon-size);
        height: var(--icon-size);
      }

      .grid-cell.title {
        padding-inline-end: 8px;
      }
    }
  }
</style>
