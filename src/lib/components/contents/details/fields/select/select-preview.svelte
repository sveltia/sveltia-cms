<!--
  @component
  Implement the preview for a Select field.
  @see https://decapcms.org/docs/widgets/#Select
  @see https://sveltiacms.app/en/docs/fields/select
-->
<script>
  import { isObjectArray } from '@sveltia/utils/array';

  import { getCanonicalLocale, getListFormatter } from '$lib/services/contents/i18n';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { SelectField, SelectFieldValue } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {SelectField} fieldConfig Field configuration.
   * @property {SelectFieldValue | SelectFieldValue[] | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const { options, multiple } = $derived(fieldConfig);
  const hasLabels = $derived(isObjectArray(options));
  const listFormatter = $derived(getListFormatter(locale));

  /**
   * Get the display label by value.
   * @param {SelectFieldValue | SelectFieldValue[]} value Value.
   * @returns {string} Label.
   */
  const getLabel = (value) =>
    hasLabels
      ? /** @type {{ label: string, value: string }[]} */ (options).find((o) => o.value === value)
          ?.label || String(value)
      : String(value);
</script>

{#if multiple && Array.isArray(currentValue) && currentValue.length}
  <p lang={getCanonicalLocale(locale)} dir="auto">
    {listFormatter.format(currentValue.map(getLabel).sort())}
  </p>
{:else if currentValue !== undefined}
  <p lang={getCanonicalLocale(locale)} dir="auto">{getLabel(currentValue)}</p>
{/if}
