<!--
  @component
  Implement the preview for the DataTime and (deprecated) Date widgets.
  @see https://decapcms.org/docs/widgets/#datetime
  @see https://decapcms.org/docs/widgets/#date
-->
<script>
  import moment from 'moment';

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
    format,
    date_format: dateFormat,
    time_format: timeFormat,
    picker_utc: pickerUTC = false,
  } = fieldConfig);
  $: dateOnly = timeFormat === false;
  $: timeOnly = dateFormat === false;

  /**
   * Get a `Date` object given the current value.
   * @returns {(Date | undefined)} Date.
   */
  const getDate = () => {
    if (!currentValue) {
      return undefined;
    }

    try {
      if (format) {
        if (pickerUTC) {
          return moment.utc(currentValue, format).toDate();
        }

        return moment(currentValue, format).toDate();
      }

      if (timeOnly) {
        return new Date(new Date(`${new Date().toJSON().split('T')[0]}T${currentValue}`));
      }

      return new Date(currentValue);
    } catch {
      return undefined;
    }
  };

  // @ts-ignore Arguments are triggers
  $: date = getDate(currentValue);
</script>

{#if date}
  <p>
    {#if timeOnly}
      {date.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric', hour12: true })}
    {:else}
      <time datetime={date.toJSON()}>
        {#if dateOnly}
          {date.toLocaleDateString(locale, { timeZone: pickerUTC ? 'UTC' : undefined })}
        {:else}
          {date.toLocaleString(locale, { timeZone: pickerUTC ? 'UTC' : undefined })}
        {/if}
      </time>
    {/if}
  </p>
{/if}
