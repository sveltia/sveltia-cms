<!--
  @component
  Edit options menu button, shared by repository assets and assets on external locations. The
  caller provides the handlers for the built-in Edit, Rename and Replace items, and any extra items.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Menu, MenuButton, MenuItem } from '@sveltia/ui';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [readOnly] Whether every edit operation is unavailable, e.g. for an Open
   * Authoring contributor.
   * @property {boolean} [canEdit] Whether the asset can be edited. The Edit item is omitted when
   * `onEdit` is not given.
   * @property {boolean} [canRename] Whether the asset can be renamed.
   * @property {boolean} [canReplace] Whether the asset can be replaced.
   * @property {() => void} [onEdit] Called when the Edit item is selected.
   * @property {() => void} onRename Called when the Rename item is selected.
   * @property {() => void} onReplace Called when the Replace item is selected.
   * @property {Snippet} [extraItems] Items placed at the top of the menu.
   * @property {Snippet} [moreItems] Items placed at the bottom of the menu, after a divider.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    readOnly = false,
    canEdit = false,
    canRename = false,
    canReplace = false,
    onEdit = undefined,
    onRename,
    onReplace,
    extraItems = undefined,
    moreItems = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<MenuButton variant="ghost" iconic popupPosition="bottom-right" aria-label={_('show_edit_options')}>
  {#snippet popup()}
    <Menu aria-label={_('edit_options')}>
      {@render extraItems?.()}
      {#if onEdit}
        <MenuItem
          variant="ghost"
          label={_('edit')}
          aria-label={_('edit_asset')}
          disabled={readOnly || !canEdit}
          onclick={onEdit}
        />
      {/if}
      <MenuItem
        variant="ghost"
        label={_('rename')}
        aria-label={_('rename_asset')}
        disabled={readOnly || !canRename}
        onclick={onRename}
      />
      <MenuItem
        variant="ghost"
        label={_('replace')}
        aria-label={_('replace_asset')}
        disabled={readOnly || !canReplace}
        onclick={onReplace}
      />
      {#if moreItems}
        <Divider />
        {@render moreItems()}
      {/if}
    </Menu>
  {/snippet}
</MenuButton>
