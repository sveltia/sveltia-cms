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
  import { isSingleItemList } from '$lib/services/contents/fields/list/helpers';
  import { getDirection } from '$lib/services/contents/i18n';
  import { createDragSorter } from '$lib/services/utils/drag-sorting.svelte';
  import { createKeyedRows } from '$lib/services/utils/keyed-rows.svelte';
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
   * Rows shown in the editor, one per item. Unlike the stored value, the rows can be blank, and
   * there is always at least one.
   */
  const rows = createKeyedRows(['']);
  /**
   * @type {HTMLElement | undefined}
   */
  let itemList = $state();

  const { i18n, max = Infinity } = $derived(fieldConfig);
  const canEdit = $derived(!readonly);
  // Removing or reordering the only row would leave nothing to type into, and has nothing to do
  const hasMultipleItems = $derived(rows.values.length > 1);
  // A list limited to one item is shown like a single input, without the controls to reorder or
  // remove the item, which can’t do anything with one row anyway
  const singleItem = $derived(isSingleItemList({ fieldConfig, itemCount: rows.values.length }));

  /**
   * Get the rows as they should be stored: trimmed, with the blank ones dropped.
   * @returns {string[]} List value.
   */
  const getStoredValue = () => rows.values.map((item) => item.trim()).filter(Boolean);

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

    rows.replace(value.length ? [...value] : ['']);
  };

  /**
   * Write the rows to the draft, unless they already hold the stored value. Rewriting an unchanged
   * value isn’t harmless: it adds the placeholder of a non-empty list, which the loaded content
   * doesn’t have, so merely opening an entry would count as a change.
   */
  const updateValue = () => {
    const draft = entryDraft.current;
    const value = getStoredValue();

    /* v8 ignore next 3 -- the editor is only rendered while the draft is there */
    if (!draft) {
      return;
    }

    if (!equal(value, currentValue ?? [])) {
      updateNonPrimitiveValue({ draft, valueStoreKey, locale, keyPath, i18n, value });
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
    rows.insert(index, '');

    await tick();
    getInput(index)?.focus();
  };

  /**
   * Remove a row and move the focus to the row that takes its place, or to the last one.
   * @param {number} index Target index.
   */
  const removeItem = async (index) => {
    rows.remove(index);

    await tick();
    getInput(Math.min(index, rows.values.length - 1))?.focus();
  };

  /**
   * Move a row to another position in the list.
   * @param {number} from Source index.
   * @param {number} to Destination index.
   */
  const moveItem = (from, to) => {
    rows.move(from, to);
  };

  const sorter = createDragSorter({
    /**
     * Get the number of items in the list.
     * @returns {number} Item count.
     */
    getItemCount: () => rows.values.length,
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
    () => $state.snapshot(rows.values),
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
  {#each sorter.displayOrder as index (rows.ids[index])}
    <div
      role="none"
      class="item"
      class:dragging={sorter.dragIndex === index}
      draggable={sorter.grabbedIndex === index}
      ondragstart={(event) => sorter.onDragStart(index, event, rows.values[index])}
      ondragend={sorter.onDragEnd}
      animate:flip={{ duration: 200 }}
    >
      {#if canEdit && !singleItem}
        <ReorderControls
          {index}
          itemCount={rows.values.length}
          disabled={!hasMultipleItems}
          onGrab={() => sorter.grab(index)}
          onRelease={sorter.release}
          onMove={(to, action) => sorter.move(index, to, action)}
        />
      {/if}
      <TextInput
        dir={getDirection(locale)}
        flex
        bind:value={rows.values[index]}
        {readonly}
        {invalid}
        required={required && rows.values.length === 1}
        ariaLabel={_('list_item_value')}
        aria-errormessage="{fieldId}-error"
        onkeydown={(/** @type {KeyboardEvent} */ event) => {
          // Ignore the Enter key while the user is typing with an IME, or in a read-only field
          if (event.key !== 'Enter' || event.isComposing || !canEdit || rows.values.length >= max) {
            return;
          }

          event.preventDefault();
          addItem(index + 1);
        }}
      />
      {#if canEdit && !singleItem}
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
{#if canEdit && rows.values.length < max}
  <div role="none" class="toolbar">
    <AddItemButton {fieldConfig} items={rows.values} addItem={() => addItem(rows.values.length)} />
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
