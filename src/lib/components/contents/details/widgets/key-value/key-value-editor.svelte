<!--
  @component
  Implement the editor for the KeyValue widget compatible with Static CMS.
  @see https://staticjscms.netlify.app/docs/widget-keyvalue
-->
<script>
  import { Button, Icon, TextInput } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { _ } from 'svelte-i18n';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import {
    getPairs,
    savePairs,
    validatePairs,
  } from '$lib/services/contents/widgets/key-value/helper';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  export let keyPath;
  /**
   * @type {string}
   */
  export let fieldId;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldLabel;
  /**
   * @type {KeyValueField}
   */
  export let fieldConfig;
  /**
   * @type {Record<string, string>}
   */
  // svelte-ignore unused-export-let
  export let currentValue;
  /**
   * @type {boolean}
   */
  export let readonly = false;
  /**
   * @type {boolean}
   */
  // svelte-ignore unused-export-let
  export let required = true;
  /**
   * @type {boolean}
   */
  // svelte-ignore unused-export-let
  export let invalid = false;

  $: ({
    i18n = false,
    // Widget-specific options
    key_label: keyLabel = $_('key_value.key'),
    value_label: valueLabel = $_('key_value.value'),
    max = Infinity,
  } = fieldConfig);

  /** @type {[string, string][]} */
  let pairs = [];
  /** @type {HTMLTableRowElement[]} */
  const rowElements = [];
  /** @type {boolean[]} */
  let edited = [];
  /** @type {('empty' | 'duplicate' | undefined)[]} */
  let validations = [];

  /**
   * Update the {@link pairs} whenever the current values are changed.
   */
  const updatePairs = () => {
    if (!$entryDraft) {
      return;
    }

    const _entryDraft = /** @type {import('svelte/store').Writable<EntryDraft>} */ (entryDraft);
    const updatedPairs = getPairs({ entryDraft: _entryDraft, keyPath, locale });

    if (!equal(pairs, updatedPairs)) {
      pairs = updatedPairs;
      edited = updatedPairs.map(() => false);
    }

    if (!pairs.length && $entryDraft.currentValues[locale][keyPath] !== null) {
      // Enable validation
      $entryDraft.currentValues[locale][keyPath] = null;
    }
  };

  /**
   * Add an empty pair to the {@link pairs} array.
   */
  const addPair = () => {
    if (!$entryDraft) {
      return;
    }

    Object.entries($entryDraft.currentValues).forEach(([_locale, content]) => {
      if (_locale === locale || i18n === 'duplicate') {
        // Remove `null` added for validation
        delete content[keyPath];
      }
    });

    pairs = [...pairs, ['', '']];
    edited = [...edited, false];

    window.requestAnimationFrame(() => {
      rowElements[pairs.length - 1].querySelector('input')?.focus();
    });
  };

  /**
   * Remove a pair from {@link pairs}.
   * @param {number} index - Index in the {@link pairs} array.
   */
  const removePair = (index) => {
    pairs.splice(index, 1);
    pairs = [...pairs];
    edited.splice(index, 1);
    edited = [...edited];
  };

  /**
   * Update the draft store whenever the {@link pairs} is updated.
   */
  const updateStore = () => {
    validations = validatePairs({ pairs, edited });

    if (!$entryDraft || validations.some(Boolean) || pairs.some(([key]) => !key.trim())) {
      return;
    }

    const _entryDraft = /** @type {import('svelte/store').Writable<EntryDraft>} */ (entryDraft);

    savePairs({ entryDraft: _entryDraft, fieldConfig, keyPath, locale, pairs });
  };

  $: {
    void $entryDraft?.currentValues[locale];
    updatePairs();
  }

  $: {
    void pairs;
    updateStore();
  }
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
          <td>
            <TextInput
              {readonly}
              flex
              bind:value={pair[0]}
              invalid={!!validations[index]}
              aria-errormessage={validations[index] ? `${fieldId}-kv-error` : undefined}
              oninput={() => {
                edited[index] = true;
              }}
            />
          </td>
          <td>
            <TextInput
              {readonly}
              flex
              bind:value={pair[1]}
              onkeydown={(event) => {
                // Add new pair with Enter key
                if (
                  !event.isComposing &&
                  event.key === 'Enter' &&
                  index === pairs.length - 1 &&
                  pairs.length < max
                ) {
                  addPair();
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

<div>
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
    text-align: left;

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
