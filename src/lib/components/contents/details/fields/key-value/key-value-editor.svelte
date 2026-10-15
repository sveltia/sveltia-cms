<!--
  @component
  Implement the editor for a KeyValue field compatible with Static CMS.

  Like a simple List field, the editor always offers a row to type into: a field without pairs shows
  one blank row, which isn’t stored until its key is filled in.
  @see https://staticjscms.netlify.app/docs/widget-keyvalue
  @see https://sveltiacms.app/en/docs/fields/keyvalue
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { TextInput } from '@sveltia/ui';
  import { getContext, tick } from 'svelte';
  import { flip } from 'svelte/animate';

  import RemoveButton from '$lib/components/common/remove-button.svelte';
  import ReorderControls from '$lib/components/common/reorder-controls.svelte';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import AddItemButton from '$lib/components/contents/details/fields/object/add-item-button.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { deferDraftWrite } from '$lib/services/contents/draft/update/deferred';
  import { getFieldValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import {
    getPairs,
    getPairsToSave,
    haveStoredPairsChanged,
    savePairs,
    shouldStorePlaceholder,
    validatePairs,
  } from '$lib/services/contents/fields/key-value/helpers';
  import { getPairsFromContent } from '$lib/services/contents/fields/key-value/pairs';
  import { getDirection } from '$lib/services/contents/i18n';
  import { focusAfterRemoval, moveListItem } from '$lib/services/utils/drag-sorting';
  import { createDragSorter } from '$lib/services/utils/drag-sorting.svelte';
  import { createKeyedRows } from '$lib/services/utils/keyed-rows.svelte';
  import { createStableDerivedState, watch } from '$lib/services/utils/state.svelte';

  /**
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import { KeyValueField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {KeyValueField} fieldConfig Field configuration.
   * @property {Record<string, string> | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldId,
    fieldConfig,
    readonly = false,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    i18n = false,
    // Field type-specific options
    key_label: _keyLabel,
    value_label: _valueLabel,
    max = Infinity,
  } = $derived(fieldConfig);
  const keyLabel = $derived(_keyLabel || _('key_value.key'));
  const valueLabel = $derived(_valueLabel || _('key_value.value'));
  const defaultLocale = $derived(entryDraft.current?.defaultLocale);
  // With the `duplicate_keys` i18n strategy, the keys are mirrored from the default locale, so they
  // can only be edited — and pairs added or removed — there; the values are editable in any locale
  const keysReadonly = $derived(
    readonly || (i18n === 'duplicate_keys' && locale !== defaultLocale),
  );

  /**
   * Key-value pairs shown in the editor, one per row.
   */
  const rows = createKeyedRows(/** @type {[string, string][]} */ ([]));
  /** @type {HTMLTableRowElement[]} */
  const rowElements = $state([]);
  /** @type {HTMLTableSectionElement | undefined} */
  let tableBody = $state();
  /** @type {boolean[]} */
  let edited = $state([]);
  /** @type {('empty' | 'duplicate' | undefined)[]} */
  let validations = $state([]);

  // Removing the blank row offered for an empty field would just bring it back
  const isOnlyBlankRow = $derived(
    rows.values.length === 1 && !rows.values[0][0] && !rows.values[0][1],
  );

  /**
   * Add a blank row if there are no pairs, so there’s always somewhere to type, unless the keys
   * can’t be edited, in which case there’s nothing to type into.
   */
  const ensureBlankRow = () => {
    if (!rows.values.length && !keysReadonly) {
      rows.insert(rows.values.length, ['', '']);
      edited.push(false);
    }
  };

  /**
   * Update the {@link rows} whenever the current values are changed.
   */
  const updatePairs = () => {
    const draft = entryDraft.current;

    /* v8 ignore next 3 -- the editor is only rendered while the draft is there */
    if (!draft) {
      return;
    }

    const updatedPairs = getPairs({ draft, valueStoreKey, keyPath, locale });
    const valueStore = draft[valueStoreKey][locale];

    if (haveStoredPairsChanged({ rows: rows.values, storedPairs: updatedPairs })) {
      // Preserve existing IDs for unchanged positions; assign new IDs for new pairs
      rows.replace([...updatedPairs], { keepIds: true });
      edited = updatedPairs.map(() => false);
    }

    ensureBlankRow();

    if (shouldStorePlaceholder({ storedPairs: updatedPairs, storedValue: valueStore[keyPath] })) {
      const _keyPath = keyPath;

      // Enable validation. This runs from an effect, so the write is deferred
      deferDraftWrite(() => {
        valueStore[_keyPath] = null;
      });
    }
  };

  /**
   * Add an empty pair to the {@link rows}.
   */
  const addPair = () => {
    rows.insert(rows.values.length, ['', '']);
    edited.push(false);

    window.requestAnimationFrame(() => {
      /** @type {HTMLInputElement} */ (
        rowElements[rows.values.length - 1].querySelector('input')
      ).focus();
    });
  };

  /**
   * Remove a pair from {@link rows}.
   * @param {number} index Row index.
   */
  const removePair = async (index) => {
    rows.remove(index);
    edited.splice(index, 1);
    ensureBlankRow();
    await tick();

    // The focused Remove button is gone along with the row, so move the focus to the Remove button
    // of the row now at the same position, or the previous row if the last one was removed. The
    // blank row left once the last pair is removed can’t be removed, so its key takes the focus
    // There’s always a row left, as the blank row takes the place of the last pair
    const { rows: rowList } = /** @type {HTMLTableSectionElement} */ (tableBody);

    focusAfterRemoval({
      index,
      /**
       * Get the Remove button of a row, or the key input if the row can’t be removed.
       * @param {number} _index Row index.
       * @returns {HTMLElement | null | undefined} Element.
       */
      getTarget: (_index) => {
        const row = rowList[_index];

        return (
          row &&
          /** @type {HTMLElement | null} */ (
            row.querySelector('td.action button:enabled') ?? row.querySelector('td.key input')
          )
        );
      },
    });
  };

  /**
   * Move a pair to another position in {@link rows}. The pairs are saved in the new order.
   * @param {number} from Source index.
   * @param {number} to Destination index.
   */
  const movePair = (from, to) => {
    rows.move(from, to);
    edited = moveListItem(edited, from, to);
  };

  const sorter = createDragSorter({
    /**
     * Get the number of pairs.
     * @returns {number} Pair count.
     */
    getItemCount: () => rows.values.length,
    /**
     * Get the table body, whose rows are the pairs.
     * @returns {HTMLTableSectionElement | undefined} Element.
     */
    getListElement: () => tableBody,
    onMove: movePair,
    /**
     * Get the key of a pair, to be attached to its drag.
     * @param {number} index Row index.
     * @returns {string} Key.
     */
    getItemData: (index) => rows.values[index][0],
  });

  /**
   * Update the draft store whenever the {@link rows} is updated.
   */
  const updateStore = () => {
    const draft = entryDraft.current;

    validations = validatePairs({ pairs: rows.values, edited });

    /* v8 ignore next 3 -- the editor is only rendered while the draft is there */
    if (!draft) {
      return;
    }

    const pairs = getPairsToSave({
      rows: rows.values,
      validations,
      /**
       * Get the pairs stored in the draft.
       * @returns {[string, string][]} Pairs.
       */
      getStoredPairs: () => getPairs({ draft, valueStoreKey, keyPath, locale }),
    });

    if (!pairs) {
      return;
    }

    const args = {
      draft,
      valueStoreKey,
      fieldConfig,
      keyPath,
      locale,
      pairs: $state.snapshot(pairs),
    };

    // This runs from an effect, so the write to the draft is deferred
    deferDraftWrite(() => {
      savePairs(args);
    });
  };

  /**
   * The pairs stored in the draft and the value at the field’s key path, which is all
   * {@link updatePairs} reads. It only changes when the field does, rather than whenever anything
   * else in the entry is changed, e.g. on every keystroke in another field.
   */
  const storedField = createStableDerivedState(() => {
    const valueMap = getFieldValueMapSnapshot(entryDraft.current, locale, keyPath, valueStoreKey);

    // A snapshot isn’t mutated, so its key paths are read from the index kept for it
    return [getPairsFromContent(valueMap, keyPath, { live: false }), valueMap[keyPath]];
  });

  watch(
    () => [storedField.current],
    () => {
      updatePairs();
    },
  );

  watch(
    () => $state.snapshot(rows.values),
    () => {
      updateStore();
    },
  );
</script>

{#if rows.values.length}
  <table>
    <thead>
      <tr>
        {#if !keysReadonly}
          <th scope="col" class="reorder" aria-label={_('reorder')}></th>
        {/if}
        <th scope="col" class="key">{keyLabel}</th>
        <th scope="col" class="value">{valueLabel}</th>
        {#if !keysReadonly}
          <th scope="col" class="action" aria-label={_('key_value.action')}></th>
        {/if}
      </tr>
    </thead>
    <tbody
      bind:this={tableBody}
      ondragovercapture={sorter.onDragOver}
      ondropcapture={sorter.onDrop}
    >
      {#each sorter.displayOrder as index (rows.ids[index])}
        <tr
          bind:this={rowElements[index]}
          class:dragging={sorter.dragIndex === index}
          {...sorter.itemProps(index)}
          animate:flip={{ duration: 200 }}
        >
          {#if !keysReadonly}
            <td class="reorder">
              <div role="none">
                <ReorderControls
                  {index}
                  itemCount={rows.values.length}
                  disabled={rows.values.length < 2}
                  onGrab={() => sorter.grab(index)}
                  onRelease={sorter.release}
                  onMove={(to, action) => sorter.move(index, to, action)}
                />
              </div>
            </td>
          {/if}
          <td class="key">
            <TextInput
              dir="ltr"
              readonly={keysReadonly}
              flex
              bind:value={rows.values[index][0]}
              invalid={!!validations[index]}
              ariaLabel={keyLabel}
              aria-errormessage={validations[index] ? `${fieldId}-kv-error` : undefined}
              oninput={() => {
                edited[index] = true;
              }}
              onkeydown={(event) => {
                // Move focus with Enter key
                if (event.key === 'Enter' && !event.isComposing) {
                  /** @type {HTMLInputElement} */ (
                    rowElements[index].querySelector('td.value input')
                  ).focus();
                }
              }}
            />
          </td>
          <td class="value">
            <TextInput
              dir={getDirection(locale)}
              {readonly}
              flex
              bind:value={rows.values[index][1]}
              ariaLabel={valueLabel}
              onkeydown={(event) => {
                // Move focus or add a new pair with Enter key. The next key is skipped when it’s
                // read-only
                if (event.key === 'Enter' && !event.isComposing) {
                  if (index < rows.values.length - 1) {
                    /** @type {HTMLInputElement} */ (
                      rowElements[index + 1].querySelector(
                        keysReadonly ? 'td.value input' : 'td.key input',
                      )
                    ).focus();
                  } else if (!keysReadonly && rows.values.length < max) {
                    addPair();
                  }
                }
              }}
            />
          </td>
          {#if !keysReadonly}
            <td class="action">
              <RemoveButton
                variant="ghost"
                disabled={isOnlyBlankRow}
                onclick={() => {
                  removePair(index);
                }}
              />
            </td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

{#if validations.some(Boolean)}
  <ValidationError id="{fieldId}-kv-error">
    {#if validations.includes('empty')}
      {_('key_value.empty_key')}
    {/if}
    {#if validations.includes('duplicate')}
      {_('key_value.duplicate_key')}
    {/if}
  </ValidationError>
{/if}

{#if rows.values.length < max}
  <div role="none" class="toolbar">
    <AddItemButton
      disabled={keysReadonly}
      {fieldConfig}
      items={rows.values}
      addItem={() => {
        addPair();
      }}
    />
  </div>
{/if}

<style>
  .toolbar {
    display: flex;
    align-items: center;
    margin-block-start: 8px;

    &:first-child {
      margin-block-start: 0;
    }
  }

  table {
    /* Space the cells like the items of a List field. The outer spacing is cancelled out by the
      negative margins, which the stretched width makes up for */
    margin: -4px;
    border-collapse: separate;
    border-spacing: 4px;
    width: -moz-available;
    width: -webkit-fill-available;
    width: stretch;
  }

  th,
  td {
    border-width: 0;
  }

  th {
    padding-block: 4px;
    color: var(--sui-tertiary-foreground-color);
    font-size: var(--sui-font-size-small);
    font-weight: var(--sui-font-weight-normal);
    text-align: start;

    &.key,
    &.value {
      width: 50%;
    }
  }

  td {
    padding: 0;
    vertical-align: middle;

    &.reorder div {
      display: flex;
      align-items: center;
    }
  }

  tr {
    /* The dragged row is left as a faint placeholder marking the gap it would drop into, like the
      items of a List field */

    &.dragging {
      opacity: 0.25;
    }
  }
</style>
