<!--
  @component
  Implement the preview for a DateTime field.
  @see https://decapcms.org/docs/widgets/#Datetime
  @see https://sveltiacms.app/en/docs/fields/datetime
-->
<script>
  import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/config';
  import {
    getDate,
    getDateTimeFieldDisplayValue,
  } from '$lib/services/contents/fields/date-time/helper';
  import { getTimeZoneLabel } from '$lib/services/contents/fields/date-time/timezone';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';

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

  const { utc, singleCustomTimeZone } = $derived(parseDateTimeConfig(fieldConfig));
  const displayValue = $derived(
    getDateTimeFieldDisplayValue({ locale, fieldConfig, currentValue }),
  );
</script>

{#if displayValue}
  <p lang={getCanonicalLocale(locale)} dir={getDirection(locale)}>
    {displayValue}
    {#if singleCustomTimeZone}
      — {getTimeZoneLabel(singleCustomTimeZone, getDate(currentValue, fieldConfig))}
    {:else if utc}
      — UTC
    {/if}
  </p>
{/if}
