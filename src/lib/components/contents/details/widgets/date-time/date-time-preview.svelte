<!--
  @component
  Implement the preview for the DataTime widget.
  @see https://decapcms.org/docs/widgets/#datetime
-->
<script>
  import { getDate } from '$lib/components/contents/details/widgets/date-time/helper';
  import { getCanonicalLocale } from '$lib/services/contents/i18n';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {DateTimeField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;

  $: ({
    // i18n,
    // Widget-specific options
    date_format: dateFormat,
    time_format: timeFormat,
    picker_utc: pickerUTC = false,
  } = fieldConfig);
  $: dateOnly = timeFormat === false;
  $: timeOnly = dateFormat === false;
  $: date = getDate(currentValue, fieldConfig);
  $: canonicalLocale = getCanonicalLocale(locale);

  /** @type {Intl.DateTimeFormatOptions} */
  const dateFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  /** @type {Intl.DateTimeFormatOptions} */
  const timeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
</script>

{#if date}
  <p>
    {#if timeOnly}
      {date.toLocaleTimeString(canonicalLocale, timeFormatOptions)}
    {:else}
      <time datetime={date.toJSON()}>
        {#if dateOnly}
          {date.toLocaleDateString(canonicalLocale, {
            ...dateFormatOptions,
            timeZone:
              pickerUTC ||
              (dateOnly && !!currentValue?.match(/^\d{4}-[01]\d-[0-3]\d$/)) ||
              (dateOnly && !!currentValue?.match(/T00:00(?::00)?(?:\.000)?Z$/))
                ? 'UTC'
                : undefined,
          })}
        {:else}
          {date.toLocaleString(canonicalLocale, {
            ...dateFormatOptions,
            ...timeFormatOptions,
            timeZone: pickerUTC ? 'UTC' : undefined,
          })}
        {/if}
      </time>
    {/if}
  </p>
{/if}
