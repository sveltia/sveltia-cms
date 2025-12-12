<!--
  @component
  Implement the preview for a Number field.
  @see https://decapcms.org/docs/widgets/#Number
-->
<script>
  import { getCanonicalLocale } from '$lib/services/contents/i18n';

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
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const { value_type: valueType = 'int' } = $derived(fieldConfig);
  const canonicalLocale = $derived(getCanonicalLocale(locale));
  const numberFormatter = $derived(Intl.NumberFormat(canonicalLocale));
</script>

{#if currentValue !== undefined && currentValue !== null && currentValue !== ''}
  <p lang={canonicalLocale} dir="auto">
    {#if valueType === 'int' || valueType === 'float'}
      {numberFormatter.format(Number(currentValue))}
    {:else}
      {currentValue}
    {/if}
  </p>
{/if}
