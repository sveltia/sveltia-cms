<!--
  @component
  Implement the preview for the Number widget.
  @see https://decapcms.org/docs/widgets/#number
-->
<script>
  import { getCanonicalLocale } from '$lib/services/contents/i18n';

  /**
   * @typedef {object} Props
   * @property {import('$lib/typedefs/public').NumberField} fieldConfig Field configuration.
   * @property {string | number | null | undefined} currentValue Field value.
   */

  /** @type {import('$lib/typedefs/private').WidgetPreviewProps & Props} */
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
  <p lang={locale} dir="auto">
    {#if valueType === 'int' || valueType === 'float'}
      {numberFormatter.format(Number(currentValue))}
    {:else}
      {currentValue}
    {/if}
  </p>
{/if}
