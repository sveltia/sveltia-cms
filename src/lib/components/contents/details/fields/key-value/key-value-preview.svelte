<!--
  @component
  Implement the preview for a KeyValue field compatible with Static CMS.
  @see https://staticjscms.netlify.app/docs/widget-keyvalue
-->
<script>
  import equal from 'fast-deep-equal';
  import { untrack } from 'svelte';
  import { _ } from 'svelte-i18n';

  import { entryDraft } from '$lib/services/contents/draft';
  import { getPairs } from '$lib/services/contents/fields/key-value/helper';

  /**
   * @import { Writable } from 'svelte/store';
   * @import { EntryDraft, FieldPreviewProps } from '$lib/types/private';
   * @import { KeyValueField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {KeyValueField} fieldConfig Field configuration.
   * @property {Record<string, string> | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldConfig,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    // Field-specific options
    key_label: _keyLabel,
    value_label: _valueLabel,
  } = $derived(fieldConfig);
  const keyLabel = $derived(_keyLabel || $_('key_value.key'));
  const valueLabel = $derived(_valueLabel || $_('key_value.value'));

  /** @type {[string, string][]}  */
  let pairs = $state([]);

  /**
   * Update the key-value {@link pairs} whenever the draft store is updated.
   */
  const updatePairs = () => {
    const _entryDraft = /** @type {Writable<EntryDraft>} */ (entryDraft);
    const updatedPairs = getPairs({ entryDraft: _entryDraft, keyPath, locale });

    if (!equal(pairs, updatedPairs)) {
      pairs = updatedPairs;
    }
  };

  $effect(() => {
    if ($entryDraft) {
      void [$state.snapshot($entryDraft.currentValues[locale])];

      untrack(() => {
        updatePairs();
      });
    }
  });
</script>

{#if pairs.length}
  <table>
    <thead>
      <tr>
        <th scope="col">{keyLabel}</th>
        <th scope="col">{valueLabel}</th>
      </tr>
    </thead>
    <tbody>
      {#each pairs as [key, value]}
        <tr>
          <td>{key}</td>
          <td>{value}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style lang="scss">
  table {
    width: -moz-available;
    width: -webkit-fill-available;
    width: stretch;
  }

  th {
    padding-block: 4px;
    width: 50%;
    color: var(--sui-tertiary-foreground-color);
    background-color: var(--sui-tertiary-background-color);
    font-size: var(--sui-font-size-small);
    font-weight: var(--sui-font-weight-normal);
    text-align: start;
  }

  td {
    &:empty::after {
      content: '\00a0'; // nbsp
    }
  }
</style>
