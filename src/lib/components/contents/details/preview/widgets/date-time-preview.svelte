<!--
  @component
  Implement the preview for the DataTime and (deprecated) Date widgets.
  @see https://www.netlifycms.org/docs/widgets/#datetime
  @see https://www.netlifycms.org/docs/widgets/#date
-->
<script>
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  // svelte-ignore unused-export-let
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({
    i18n,
    // Widget-specific options
    format,
    date_format: dateFormat,
    time_format: timeFormat,
    picker_utc: pickerUTC = false,
  } = fieldConfig);
  $: dateOnly = timeFormat === false;
  $: date = currentValue ? new Date(currentValue) : undefined;
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
  <p>
    <time datetime={date.toJSON()}>
      {#if dateOnly}
        {date.toDateString(locale)}
      {:else}
        {date.toLocaleString(locale)}
      {/if}
    </time>
  </p>
{/if}
