<!--
  @component
  Implement the preview for the KeyValue widget compatible with Static CMS.
  @see https://staticjscms.netlify.app/docs/widget-keyvalue
-->
<script>
  import equal from 'fast-deep-equal';
  import { _ } from 'svelte-i18n';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getPairs } from '$lib/services/contents/widgets/key-value/helper';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  export let keyPath;
  /**
   * @type {KeyValueField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let currentValue;

  $: ({
    // Widget-specific options
    key_label: keyLabel = $_('key_value.key'),
    value_label: valueLabel = $_('key_value.value'),
  } = fieldConfig);

  /** @type {[string, string][]}  */
  let pairs = [];

  /**
   * Update the key-value {@link pairs} whenever the draft store is updated.
   */
  const updatePairs = () => {
    const _entryDraft = /** @type {import('svelte/store').Writable<EntryDraft>} */ (entryDraft);
    const updatedPairs = getPairs({ entryDraft: _entryDraft, keyPath, locale });

    if (!equal(pairs, updatedPairs)) {
      pairs = updatedPairs;
    }
  };

  $: {
    if ($entryDraft) {
      void $entryDraft.currentValues[locale];
      updatePairs();
    }
  }
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
    text-align: left;
  }

  td {
    &:empty::after {
      content: '\00a0'; // nbsp
    }
  }
</style>
