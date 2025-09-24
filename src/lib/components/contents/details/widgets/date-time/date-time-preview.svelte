<!--
  @component
  Implement the preview for the DataTime widget.
  @see https://decapcms.org/docs/widgets/#datetime
-->
<script>
  import { getCanonicalLocale } from '$lib/services/contents/i18n';
  import { getDateTimeFieldDisplayValue } from '$lib/services/contents/widgets/date-time/helper';

  /**
   * @import { WidgetPreviewProps } from '$lib/types/private';
   * @import { DateTimeField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {DateTimeField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const displayValue = $derived(
    getDateTimeFieldDisplayValue({ locale, fieldConfig, currentValue }),
  );
</script>

{#if displayValue}
  <p lang={getCanonicalLocale(locale)} dir="auto">
    {displayValue}
    {#if fieldConfig.picker_utc}
      UTC
    {/if}
  </p>
{/if}
