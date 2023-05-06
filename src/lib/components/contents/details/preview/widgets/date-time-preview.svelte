<!--
  @component
  Implement the preview for the DataTime and (deprecated) Date widgets.
  @see https://decapcms.org/docs/widgets/#datetime
  @see https://decapcms.org/docs/widgets/#date
-->
<script>
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({
    // i18n,
    // Widget-specific options
    // format,
    date_format: dateFormat,
    time_format: timeFormat,
    picker_utc: pickerUTC = false,
  } = fieldConfig);
  $: dateOnly = timeFormat === false;
  $: timeOnly = dateFormat === false;
  $: date = currentValue
    ? new Date(
        timeOnly ? new Date(`${new Date().toJSON().split('T')[0]}T${currentValue}`) : currentValue,
      )
    : undefined;
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
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
