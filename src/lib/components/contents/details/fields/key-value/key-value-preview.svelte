<!--
  @component
  Implement the preview for a KeyValue field compatible with Static CMS.
  @see https://staticjscms.netlify.app/docs/widget-keyvalue
  @see https://sveltiacms.app/en/docs/fields/keyvalue
-->
<script>
  import { _ } from '@sveltia/i18n';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { getPairsFromContent } from '$lib/services/contents/fields/key-value/pairs';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { KeyValueField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {KeyValueField} fieldConfig Field configuration.
   * @property {Record<string, string> | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldConfig,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    // Field type-specific options
    key_label: _keyLabel,
    value_label: _valueLabel,
  } = $derived(fieldConfig);
  const keyLabel = $derived(_keyLabel || _('key_value.key'));
  const valueLabel = $derived(_valueLabel || _('key_value.value'));

  // The shared snapshot of the locale’s values is only taken once per change, and its key paths are
  // indexed, so the pairs are looked up without going through all the values
  const pairs = $derived(
    getPairsFromContent(getValueMapSnapshot(entryDraft.current, locale), keyPath, { live: false }),
  );
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
      {#each pairs as [key, value], index (`${key}-${index}`)}
        <tr>
          <td>{key}</td>
          <td>{value}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
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
      content: '\00a0'; /* nbsp */
    }
  }
</style>
