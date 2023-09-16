<!--
  @component
  Implement the preview for the DataTime and (deprecated) Date widgets.
  @see https://decapcms.org/docs/widgets/#datetime
  @see https://decapcms.org/docs/widgets/#date
-->
<script>
  import { getDate } from '$lib/components/contents/details/widgets/date-time/helper';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  /**
   * @type {DateTimeField}
   */
  export let fieldConfig = undefined;
  /**
   * @type {string}
   */
  export let currentValue = undefined;

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

  /** @type {Intl.DateTimeFormatOptions} */
  const dateFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  /** @type {Intl.DateTimeFormatOptions} */
  const timeFormatOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
</script>

{#if date}
  <p>
    {#if timeOnly}
      {date.toLocaleTimeString(locale, timeFormatOptions)}
    {:else}
      <time datetime={date.toJSON()}>
        {#if dateOnly}
          {date.toLocaleDateString(locale, {
            ...dateFormatOptions,
            timeZone:
              pickerUTC ||
              (dateOnly && !!currentValue?.match(/^\d{4}-[01]\d-[0-3]\d$/)) ||
              (dateOnly && !!currentValue?.match(/T00:00(?::00)?(?:\.000)?Z$/))
                ? 'UTC'
                : undefined,
          })}
        {:else}
          {date.toLocaleString(locale, {
            ...dateFormatOptions,
            ...timeFormatOptions,
            timeZone: pickerUTC ? 'UTC' : undefined,
          })}
        {/if}
      </time>
    {/if}
  </p>
{/if}
