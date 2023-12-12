<!--
  @component
  Implement the preview for the Number widget.
  @see https://decapcms.org/docs/widgets/#number
-->
<script>
  import { getCanonicalLocale } from '$lib/services/contents/i18n';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {NumberField}
   */
  export let fieldConfig;
  /**
   * @type {string | number}
   */
  export let currentValue;

  $: ({
    // Widget-specific options
    value_type: valueType = 'int',
  } = fieldConfig);

  $: canonicalLocale = getCanonicalLocale(locale);
  $: numberFormatter = Intl.NumberFormat(canonicalLocale);
</script>

{#if currentValue === undefined || currentValue === ''}
  <!--  -->
{:else if valueType === 'int' || valueType === 'float'}
  <p>{numberFormatter.format(Number(currentValue))}</p>
{:else}
  <p>{currentValue}</p>
{/if}
