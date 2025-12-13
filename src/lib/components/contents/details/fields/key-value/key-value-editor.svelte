<!--
  @component
  Implement the editor for a KeyValue field compatible with Static CMS.
  @see https://staticjscms.netlify.app/docs/widget-keyvalue
-->
<script>
  import { Button, Icon, TextInput } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { getContext, untrack } from 'svelte';
  import { _ } from 'svelte-i18n';

  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import {
    getPairs,
    savePairs,
    validatePairs,
  } from '$lib/services/contents/fields/key-value/helper';

  /**
   * @import { Writable } from 'svelte/store';
   * @import { EntryDraft, FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import { KeyValueField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {KeyValueField} fieldConfig Field configuration.
   * @property {Record<string, string> | undefined} currentValue Field value.
   */

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
  const keyLabel = $derived(_keyLabel || $_('key_value.key'));
  const valueLabel = $derived(_valueLabel || $_('key_value.value'));

  /** @type {[string, string][]} */
  let pairs = $state([]);
  /** @type {HTMLTableRowElement[]} */
  const rowElements = $state([]);
  /** @type {boolean[]} */
  let edited = $state([]);
  /** @type {('empty' | 'duplicate' | undefined)[]} */
  let validations = $state([]);

  /**
   * Update the {@link pairs} whenever the current values are changed.
   */
  const updatePairs = () => {
    if (!$entryDraft) {
      return;
    }

    const _entryDraft = /** @type {Writable<EntryDraft>} */ (entryDraft);
    const updatedPairs = getPairs({ entryDraft: _entryDraft, valueStoreKey, keyPath, locale });

    if (!equal(pairs, updatedPairs)) {
      pairs = [...updatedPairs];
      edited = updatedPairs.map(() => false);
    }

    if (!pairs.length && $entryDraft[valueStoreKey][locale][keyPath] !== null) {
      // Enable validation
      $entryDraft[valueStoreKey][locale][keyPath] = null;
    }
  };

  /**
   * Add an empty pair to the {@link pairs} array.
   */
  const addPair = () => {
    if (!$entryDraft) {
      return;
    }

    Object.entries($entryDraft[valueStoreKey]).forEach(([_locale, content]) => {
      if (_locale === locale || i18n === 'duplicate') {
        // Remove `null` added for validation
        delete content[keyPath];
      }
    });

    pairs.push(['', '']);
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
    edited.splice(index, 1);
  };

  /**
   * Update the draft store whenever the {@link pairs} is updated.
   */
  const updateStore = () => {
    validations = validatePairs({ pairs, edited });

    if (!$entryDraft || validations.some(Boolean) || pairs.some(([key]) => !key.trim())) {
      return;
    }

    const _entryDraft = /** @type {Writable<EntryDraft>} */ (entryDraft);

    savePairs({ entryDraft: _entryDraft, fieldConfig, keyPath, locale, pairs });
  };

  $effect(() => {
    void [$state.snapshot($entryDraft?.[valueStoreKey][locale])];

    untrack(() => {
      updatePairs();
    });
  });

  $effect(() => {
    void [$state.snapshot(pairs)];

    untrack(() => {
      updateStore();
    });
  });
</script>

{#if pairs.length}
  <table>
    <thead>
      <tr>
        <th scope="col" class="key">{keyLabel}</th>
        <th scope="col" class="value">{valueLabel}</th>
        {#if !readonly}
          <th scope="col" class="action" aria-label={$_('key_value.action')}></th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each pairs as pair, index}
        <tr bind:this={rowElements[index]}>
          <td class="key">
            <TextInput
              {readonly}
              flex
              bind:value={pair[0]}
              invalid={!!validations[index]}
              aria-label={keyLabel}
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
              {readonly}
              flex
              bind:value={pair[1]}
              aria-label={valueLabel}
              onkeydown={(event) => {
                // Move focus or add a new pair with Enter key
                if (event.key === 'Enter' && !event.isComposing) {
                  if (index < pairs.length - 1) {
                    /** @type {HTMLInputElement} */ (
                      rowElements[index + 1].querySelector('input')
                    ).focus();
                  } else if (pairs.length < max) {
                    addPair();
                  }
                }
              }}
            />
          </td>
          {#if !readonly}
            <td class="action">
              <Button
                variant="ghost"
                size="small"
                iconic
                aria-label={$_('remove')}
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
      {$_('key_value.empty_key')}
    {/if}
    {#if validations.includes('duplicate')}
      {$_('key_value.duplicate_key')}
    {/if}
  </ValidationError>
{/if}

<div role="none">
  <Button
    label={$_('add')}
    variant="tertiary"
    disabled={readonly || pairs.length >= max}
    onclick={() => {
      addPair();
    }}
  />
</div>

<style lang="scss">
  table {
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
  }
</style>
