<!--
  @component
  Implement the options menu of an item in a List field with subfield(s): copy, paste, duplicate and
  add buttons.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Menu, MenuButton, MenuItem } from '@sveltia/ui';

  import { getFieldLabel } from '$lib/services/contents/i18n/options';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   * @import { ListFieldWithTypes } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {number} index Index of the item.
   * @property {InternalLocaleCode} locale Locale being edited.
   * @property {NonNullable<ListFieldWithTypes['types']> | undefined} variableTypes Variable types
   * the new items can have, if the list has them.
   * @property {boolean} unknownType Whether the item has an unknown type.
   * @property {boolean} allowAdd Whether items can be added.
   * @property {boolean} allowRemove Whether items can be removed.
   * @property {boolean} allowDuplicate Whether items can be duplicated.
   * @property {boolean} hasMaxItems Whether the list is full.
   * @property {boolean} isAddDisabled Whether adding items is disabled.
   * @property {(index: number) => void} copyItem Copy the item.
   * @property {(index: number, options?: { replace?: boolean }) => void} pasteItem Paste an item.
   * @property {(args: { index: number, dupIndex?: number, type?: string }) => void} addItem Add an
   * item.
   */

  /** @type {Props} */
  const {
    index,
    locale,
    variableTypes = undefined,
    unknownType,
    allowAdd,
    allowRemove,
    allowDuplicate,
    hasMaxItems,
    isAddDisabled,
    copyItem,
    pasteItem,
    addItem,
  } = $props();
</script>

{#snippet addPositionItems(/** @type {number} */ insertIndex, /** @type {string} */ position)}
  {#if variableTypes}
    <MenuItem label={_(`add_item_${position}`)} disabled={isAddDisabled}>
      <!-- eslint-disable-next-line no-shadow -->
      {#snippet items()}
        {#each variableTypes as type (type.name)}
          <MenuItem
            label={getFieldLabel({ config: type, locale })}
            onclick={() => addItem({ index: insertIndex, type: type.name })}
          />
        {/each}
      {/snippet}
    </MenuItem>
  {:else}
    <MenuItem
      label={_(`add_item_${position}`)}
      disabled={isAddDisabled}
      onclick={() => addItem({ index: insertIndex })}
    />
  {/if}
{/snippet}

<MenuButton
  variant="ghost"
  size="small"
  iconic
  popupPosition="bottom-right"
  aria-label={_('list_item_options')}
>
  {#snippet popup()}
    <Menu ariaLabel={_('list_item_options')}>
      <!-- An item can be copied from a read-only list as well -->
      <MenuItem label={_('copy')} disabled={unknownType} onclick={() => copyItem(index)} />
      {#if allowAdd && allowRemove}
        <!-- Replacing an item doesn’t change the number of items -->
        <MenuItem
          label={_('paste_item_to_replace')}
          disabled={isAddDisabled}
          onclick={() => pasteItem(index, { replace: true })}
        />
      {/if}
      {#if allowAdd && !hasMaxItems}
        <MenuItem
          label={_('paste_item_above')}
          disabled={isAddDisabled}
          onclick={() => pasteItem(index)}
        />
        <MenuItem
          label={_('paste_item_below')}
          disabled={isAddDisabled}
          onclick={() => pasteItem(index + 1)}
        />
        <Divider />
        {#if allowDuplicate}
          <MenuItem
            label={_('duplicate')}
            disabled={isAddDisabled || unknownType}
            onclick={() => addItem({ index: index + 1, dupIndex: index })}
          />
        {/if}
        {@render addPositionItems(index, 'above')}
        {@render addPositionItems(index + 1, 'below')}
      {/if}
    </Menu>
  {/snippet}
</MenuButton>
