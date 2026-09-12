<!--
  @component
  Implement the editor for a List field without subfield(s).

  Each item is a row with its own single-line input, so items can be reordered and removed
  individually. The rows are held locally rather than being read straight from the draft: a blank
  row is a real editing state that has no representation in the stored value, which is always the
  trimmed, blank-free projection of the rows. There is always at least one row, so an empty list
  still offers somewhere to type.
  @see https://decapcms.org/docs/widgets/#List
  @see https://sveltiacms.app/en/docs/fields/list
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, TextInput } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { getContext, tick } from 'svelte';
  import { flip } from 'svelte/animate';

  import ReorderControls from '$lib/components/common/reorder-controls.svelte';
  import AddItemButton from '$lib/components/contents/details/fields/object/add-item-button.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { updateNonPrimitiveValue } from '$lib/services/contents/draft/update';
  import { getDirection } from '$lib/services/contents/i18n';
  import { moveListItem } from '$lib/services/utils/drag-sorting';
  import { createDragSorter } from '$lib/services/utils/drag-sorting.svelte';
  import { watch } from '$lib/services/utils/state.svelte';

  /**
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import { SimpleListField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {SimpleListField} fieldConfig Field configuration.
   * @property {string[]} currentValue Field value.
   */

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};
  const entryDraft = getEntryDraftContext();

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldId,
    fieldConfig,
    currentValue,
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Item values shown in the editor, one per row. Unlike the stored value, this can hold blank rows
   * and always has at least one entry.
   * @type {string[]}
   */
  let items = $state(['']);
  /**
   * Stable identifiers for the rows, so that the `each` block below keeps following a row as the
   * list is reordered rather than following its position.
   * @type {number[]}
   */
  let itemIds = $state([0]);
  let nextItemId = 1;
  /**
   * @type {HTMLElement | undefined}
   */
  let itemList = $state();

  const { i18n, max = Infinity } = $derived(fieldConfig);
  const canEdit = $derived(!readonly);
  // Removing or reordering the only row would leave nothing to type into, and has nothing to do
  const hasMultipleItems = $derived(items.length > 1);

  /**
   * Get the rows as they should be stored: trimmed, with the blank ones dropped.
   * @returns {string[]} List value.
   */
  const getStoredValue = () => items.map((item) => item.trim()).filter(Boolean);

  /**
   * Replace all the rows, giving each a fresh identifier.
   * @param {string[]} value Item values.
   */
  const setItems = (value) => {
    items = value;

    itemIds = value.map(() => {
      nextItemId += 1;

      return nextItemId - 1;
    });
  };

  /**
   * Adopt a value that changed outside the editor, such as a locale switch or a restored backup.
   *
   * A write of our own comes back through the `currentValue` prop, and adopting that would discard
   * any blank row the user is part-way through filling in. The stored value is exactly the rows’
   * projection, so anything matching it is our own echo and the rows are already up to date.
   */
  const syncFromValue = () => {
    const value = currentValue ?? [];

    if (equal(getStoredValue(), value)) {
      return;
    }

    setItems(value.length ? [...value] : ['']);
  };

  /**
   * Write the rows to the draft.
   */
  const updateValue = () => {
    const draft = entryDraft.current;

    if (draft) {
      updateNonPrimitiveValue({
        draft,
        valueStoreKey,
        locale,
        keyPath,
        i18n,
        value: getStoredValue(),
      });
    }
  };

  /**
   * Get the input in the row at the given index.
   * @param {number} index Target index.
   * @returns {HTMLInputElement | null | undefined} Input element.
   */
  const getInput = (index) => itemList?.children[index]?.querySelector('input');

  /**
   * Insert a blank row and move the focus into it.
   * @param {number} index Index to insert at.
   */
  const addItem = async (index) => {
    items.splice(index, 0, '');
    itemIds.splice(index, 0, nextItemId);
    nextItemId += 1;

    await tick();
    getInput(index)?.focus();
  };

  /**
   * Remove a row and move the focus to the row that takes its place, or to the last one.
   * @param {number} index Target index.
   */
  const removeItem = async (index) => {
    items.splice(index, 1);
    itemIds.splice(index, 1);

    await tick();
    getInput(Math.min(index, items.length - 1))?.focus();
  };

  /**
   * Move a row to another position in the list.
   * @param {number} from Source index.
   * @param {number} to Destination index.
   * @param {string} [action] `data-action` of the reorder control that triggered the move, so the
   * focus can be restored to the matching control on the row once it has moved.
   */
  const moveItem = async (from, to, action = 'reorder') => {
    items = moveListItem(items, from, to);
    itemIds = moveListItem(itemIds, from, to);

    await tick();

    // Move the focus back to the control on the row that was just moved, so that it can be used
    // repeatedly without having to find it again
    /** @type {HTMLElement | null | undefined} */ (
      itemList?.children[to]?.querySelector(`button[data-action="${action}"]`)
    )?.focus();
  };

  const sorter = createDragSorter({
    /**
     * Get the number of items in the list.
     * @returns {number} Item count.
     */
    getItemCount: () => items.length,
    /**
     * Get the list element.
     * @returns {HTMLElement | undefined} Element.
     */
    getListElement: () => itemList,
    onMove: moveItem,
  });

  watch(
    () => currentValue,
    () => {
      syncFromValue();
    },
  );

  watch(
    () => $state.snapshot(items),
    () => {
      updateValue();
    },
  );
</script>

<div
  role="none"
  class="item-list"
  bind:this={itemList}
  ondragovercapture={sorter.onDragOver}
  ondropcapture={sorter.onDrop}
>
  {#each sorter.displayOrder as index (itemIds[index])}
    <div
      role="none"
      class="item"
      class:dragging={sorter.dragIndex === index}
      draggable={sorter.grabbedIndex === index}
      ondragstart={(event) => sorter.onDragStart(index, event, items[index])}
      ondragend={sorter.onDragEnd}
      animate:flip={{ duration: 200 }}
    >
      {#if canEdit}
        <ReorderControls
          {index}
          itemCount={items.length}
          disabled={!hasMultipleItems}
          onGrab={() => sorter.grab(index)}
          onRelease={sorter.release}
          onMove={(to, action) => moveItem(index, to, action)}
        />
      {/if}
      <TextInput
        dir={getDirection(locale)}
        flex
        bind:value={items[index]}
        {readonly}
        {invalid}
        required={required && items.length === 1}
        aria-label={_('list_item_value')}
        aria-errormessage="{fieldId}-error"
        onkeydown={(/** @type {KeyboardEvent} */ event) => {
          // Ignore the Enter key while the user is typing with an IME
          if (event.key !== 'Enter' || event.isComposing || items.length >= max) {
            return;
          }

          event.preventDefault();
          addItem(index + 1);
        }}
      />
      {#if canEdit}
        <Button
          variant="ghost"
          size="small"
          iconic
          disabled={!hasMultipleItems}
          aria-label={_('remove')}
          onclick={() => {
            removeItem(index);
          }}
        >
          {#snippet startIcon()}
            <Icon name="close" />
          {/snippet}
        </Button>
      {/if}
    </div>
  {/each}
</div>
{#if canEdit}
  <div role="none" class="toolbar">
    <AddItemButton {fieldConfig} {items} addItem={() => addItem(items.length)} />
  </div>
{/if}

<style>
  .item-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    margin-block-start: 8px;
  }

  .item {
    display: flex;
    align-items: center;
    gap: 4px;

    /* The dragged row is left as a faint placeholder marking the gap it would drop into. The
      pointer already carries the browser’s own drag image of it, so showing it twice at full
      strength would just be confusing. */

    &.dragging {
      opacity: 0.25;
    }
  }
</style>
