<!--
  @component
  Implement the preview for a Number field.
  @see https://decapcms.org/docs/widgets/#Number
  @see https://sveltiacms.app/en/docs/fields/number
-->
<script>
  import { getNumberFormatter } from '$lib/services/contents/fields/number/helpers';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { NumberField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {NumberField} fieldConfig Field configuration.
   * @property {string | number | null | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const canonicalLocale = $derived(getCanonicalLocale(locale));
  const number = $derived(Number(currentValue));
  // Text that isn’t a number, which the editor stores so it can be reported as invalid, is shown as
  // is rather than as `NaN`
  const displayValue = $derived(
    Number.isNaN(number) ? currentValue : getNumberFormatter(canonicalLocale).format(number),
  );
</script>

{#if currentValue !== undefined && currentValue !== null && currentValue !== ''}
  <p lang={canonicalLocale} dir={getDirection(locale)}>
    {displayValue}
  </p>
{/if}
