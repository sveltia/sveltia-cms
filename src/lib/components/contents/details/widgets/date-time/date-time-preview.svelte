<!--
  @component
  Implement the preview for the DataTime widget.
  @see https://decapcms.org/docs/widgets/#datetime
-->
<script>
  import { getCanonicalLocale } from '$lib/services/contents/i18n';
  import { getDate, parseDateTimeConfig } from '$lib/services/contents/widgets/date-time/helper';
  import { dateFormatOptions, timeFormatOptions } from '$lib/services/utils/date';

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

  $: ({ dateOnly, timeOnly, utc } = parseDateTimeConfig(fieldConfig));
  $: date = getDate(currentValue, fieldConfig);
  $: canonicalLocale = getCanonicalLocale(locale);

  const dateRegex = /^\d{4}-[01]\d-[0-3]\d$/;
  const timeSuffixRegex = /T00:00(?::00)?(?:\.000)?Z$/;
</script>

{#if date}
  <p lang={locale} dir="auto">
    {#if timeOnly}
      {date.toLocaleTimeString(canonicalLocale, timeFormatOptions)}
    {:else}
      <time datetime={date.toJSON()}>
        {#if dateOnly}
          {date.toLocaleDateString(canonicalLocale, {
            ...dateFormatOptions,
            timeZone:
              utc ||
              (dateOnly && !!currentValue?.match(dateRegex)) ||
              (dateOnly && !!currentValue?.match(timeSuffixRegex))
                ? 'UTC'
                : undefined,
          })}
        {:else}
          {date.toLocaleString(canonicalLocale, {
            ...dateFormatOptions,
            ...timeFormatOptions,
            timeZone: utc ? 'UTC' : undefined,
            timeZoneName: utc ? undefined : 'short',
          })}
        {/if}
      </time>
    {/if}
    {#if utc}
      UTC
    {/if}
  </p>
{/if}
