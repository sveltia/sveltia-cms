<!--
  @component
  Implement the preview for a DateTime field.
  @see https://decapcms.org/docs/widgets/#Datetime
-->
<script>
  import { getDateTimeFieldDisplayValue } from '$lib/services/contents/fields/date-time/helper';
  import { getCanonicalLocale } from '$lib/services/contents/i18n';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { DateTimeField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {DateTimeField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
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
