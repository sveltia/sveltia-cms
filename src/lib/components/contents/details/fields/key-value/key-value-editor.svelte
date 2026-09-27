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
  import { Button, Icon, TextInput } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { getContext, tick } from 'svelte';
  import { flip } from 'svelte/animate';

  import ReorderControls from '$lib/components/common/reorder-controls.svelte';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import AddItemButton from '$lib/components/contents/details/fields/object/add-item-button.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import {
    getPairs,
    savePairs,
    validatePairs,
  } from '$lib/services/contents/fields/key-value/helpers';
  import { getDirection } from '$lib/services/contents/i18n';
  import { focusReorderControl, moveListItem } from '$lib/services/utils/drag-sorting';
  import { createDragSorter } from '$lib/services/utils/drag-sorting.svelte';
  import { watch } from '$lib/services/utils/state.svelte';

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

  /** @type {[string, string][]} */
  let pairs = $state([]);
  /** @type {number[]} */
  let pairIds = $state([]);
  let nextPairId = 0;
  /** @type {HTMLTableRowElement[]} */
  const rowElements = $state([]);
  /** @type {HTMLTableSectionElement | undefined} */
  let tableBody = $state();
  /** @type {boolean[]} */
  let edited = $state([]);
  /** @type {('empty' | 'duplicate' | undefined)[]} */
  let validations = $state([]);

  // Removing the blank row offered for an empty field would just bring it back
  const isOnlyBlankRow = $derived(pairs.length === 1 && !pairs[0][0] && !pairs[0][1]);

  /**
   * Add a blank row if there are no pairs, so there’s always somewhere to type, unless the keys
   * can’t be edited, in which case there’s nothing to type into.
   */
  const ensureBlankRow = () => {
    if (!pairs.length && !keysReadonly) {
      pairs.push(['', '']);
      pairIds.push(nextPairId);
      nextPairId += 1;
      edited.push(false);
    }
  };

  /**
   * Update the {@link pairs} whenever the current values are changed.
   */
  const updatePairs = () => {
    const draft = entryDraft.current;

    /* v8 ignore next 3 -- the editor is only rendered while the draft is there */
    if (!draft) {
      return;
    }

    const updatedPairs = getPairs({ draft, valueStoreKey, keyPath, locale });
    // A pair whose key is still empty hasn’t been written to the draft — adding one removes the
    // `null` placeholder from the draft, which is what runs this — so it doesn’t count as a change
    const savedPairs = pairs.filter(([key]) => key.trim());

    if (!equal(savedPairs, updatedPairs)) {
      pairs = [...updatedPairs];
      // Preserve existing IDs for unchanged positions; assign new IDs for new pairs
      pairIds = updatedPairs.map((_pair, i) => {
        if (i < pairIds.length) {
          return pairIds[i];
        }

        nextPairId += 1;

        return nextPairId - 1;
      });
      edited = updatedPairs.map(() => false);
    }

    ensureBlankRow();

    // A blank row isn’t stored, so the field holds nothing until a key is filled in
    if (!updatedPairs.length && draft[valueStoreKey][locale][keyPath] !== null) {
      const valueStore = draft[valueStoreKey][locale];
      const _keyPath = keyPath;

      // Enable validation. This runs from an effect, so the write is deferred like the one in
      // `updateStore()`
      queueMicrotask(() => {
        valueStore[_keyPath] = null;
      });
    }
  };

  /**
   * Add an empty pair to the {@link pairs} array.
   */
  const addPair = () => {
    pairs.push(['', '']);
    pairIds.push(nextPairId);
    nextPairId += 1;
    edited.push(false);

    window.requestAnimationFrame(() => {
      /** @type {HTMLInputElement} */ (
        rowElements[pairs.length - 1].querySelector('input')
      ).focus();
    });
  };

  /**
   * Remove a pair from {@link pairs}.
   * @param {number} index Index in the {@link pairs} array.
   */
  const removePair = (index) => {
    pairs.splice(index, 1);
    pairIds.splice(index, 1);
    edited.splice(index, 1);
    ensureBlankRow();
  };

  /**
   * Move a pair to another position in {@link pairs}. The pairs are saved in the new order.
   * @param {number} from Source index.
   * @param {number} to Destination index.
   * @param {string} [action] `data-action` of the reorder control that triggered the move, so the
   * focus can be restored to the matching control on the row once it has moved.
   */
  const movePair = async (from, to, action = 'reorder') => {
    pairs = moveListItem(pairs, from, to);
    pairIds = moveListItem(pairIds, from, to);
    edited = moveListItem(edited, from, to);

    await tick();
    focusReorderControl({ listElement: tableBody, index: to, action });
  };

  const sorter = createDragSorter({
    /**
     * Get the number of pairs.
     * @returns {number} Pair count.
     */
    getItemCount: () => pairs.length,
    /**
     * Get the table body, whose rows are the pairs.
     * @returns {HTMLTableSectionElement | undefined} Element.
     */
    getListElement: () => tableBody,
    onMove: movePair,
  });

  /**
   * Update the draft store whenever the {@link pairs} is updated.
   */
  const updateStore = () => {
    const draft = entryDraft.current;

    validations = validatePairs({ pairs, edited });

    const keyedPairs = pairs.filter(([key]) => key.trim());

    if (!draft || validations.some(Boolean)) {
      return;
    }

    if (keyedPairs.length) {
      // Wait until every row has a key before saving
      if (keyedPairs.length !== pairs.length) {
        return;
      }
    } else if (
      // With no key in any row, the field holds no pairs, which only has to be saved when the last
      // pair has just been removed, leaving a blank row that isn’t stored. A blank pair stored as
      // the default value of a required field is left alone, so opening an entry changes nothing
      !getPairs({ draft, valueStoreKey, keyPath, locale }).some(([key]) => key.trim())
    ) {
      return;
    }

    const args = {
      draft,
      valueStoreKey,
      fieldConfig,
      keyPath,
      locale,
      pairs: $state.snapshot(keyedPairs),
    };

    // This runs from an effect, so defer the write to the draft like `<FieldEditor>` does: a write
    // made while an effect is running makes Svelte walk the derived graph below the value map
    // without memoizing, which takes exponentially longer with each level of nesting
    queueMicrotask(() => {
      savePairs(args);
    });
  };

  watch(
    () => [getValueMapSnapshot(entryDraft.current, locale, valueStoreKey)],
    () => {
      updatePairs();
    },
  );

  watch(
    () => $state.snapshot(pairs),
    () => {
      updateStore();
    },
  );
</script>

{#if pairs.length}
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
      {#each sorter.displayOrder as index (pairIds[index])}
        <tr
          bind:this={rowElements[index]}
          class:dragging={sorter.dragIndex === index}
          draggable={sorter.grabbedIndex === index}
          ondragstart={(event) => sorter.onDragStart(index, event, pairs[index][0])}
          ondragend={sorter.onDragEnd}
          animate:flip={{ duration: 200 }}
        >
          {#if !keysReadonly}
            <td class="reorder">
              <div role="none">
                <ReorderControls
                  {index}
                  itemCount={pairs.length}
                  disabled={pairs.length < 2}
                  onGrab={() => sorter.grab(index)}
                  onRelease={sorter.release}
                  onMove={(to, action) => movePair(index, to, action)}
                />
              </div>
            </td>
          {/if}
          <td class="key">
            <TextInput
              dir="ltr"
              readonly={keysReadonly}
              flex
              bind:value={pairs[index][0]}
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
              bind:value={pairs[index][1]}
              ariaLabel={valueLabel}
              onkeydown={(event) => {
                // Move focus or add a new pair with Enter key
                if (event.key === 'Enter' && !event.isComposing) {
                  if (index < pairs.length - 1) {
                    /** @type {HTMLInputElement} */ (
                      rowElements[index + 1].querySelector('input')
                    ).focus();
                  } else if (!keysReadonly && pairs.length < max) {
                    addPair();
                  }
                }
              }}
            />
          </td>
          {#if !keysReadonly}
            <td class="action">
              <Button
                variant="ghost"
                size="small"
                iconic
                aria-label={_('remove')}
                disabled={isOnlyBlankRow}
                onclick={() => {
                  removePair(index);
                }}
              >
                {#snippet startIcon()}
                  <Icon name="close" />
                {/snippet}
              </Button>
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

{#if pairs.length < max}
  <div role="none" class="toolbar">
    <AddItemButton
      disabled={keysReadonly}
      {fieldConfig}
      items={pairs}
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
