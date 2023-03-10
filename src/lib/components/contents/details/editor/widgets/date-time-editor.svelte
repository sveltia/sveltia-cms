<!--
  @component
  Implement the editor for the DataTime and (deprecated) Date widgets.
  @see https://www.netlifycms.org/docs/widgets/#datetime
  @see https://www.netlifycms.org/docs/widgets/#date
  @todo Replace the native `<input>` with a custom component.
-->
<script>
  import moment from 'moment';
  import { onMount } from 'svelte';
  import { defaultContentLocale } from '$lib/services/config';
  import { getDateTimeParts } from '$lib/services/utils/datetime';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
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
  $: disabled = i18n === 'duplicate' && locale !== $defaultContentLocale;
  $: dateOnly = timeFormat === false;

  let dateTimeParts;
  let initialValue;
  let inputValue;

  /**
   * Set the current value given the input value.
   */
  const setCurrentValue = () => {
    if (format) {
      currentValue = moment(inputValue).format(format);
    } else {
      const timeZoneStr = pickerUTC ? 'Z' : dateTimeParts.timeZoneName.replace('GMT', '');

      currentValue = dateOnly
        ? `${inputValue}T:00:00${timeZoneStr}`
        : `${inputValue}${timeZoneStr}`;
    }
  };

  onMount(() => {
    dateTimeParts = getDateTimeParts({
      date: currentValue ? moment(currentValue, format).toDate() : new Date(),
      timeZone: pickerUTC ? 'UTC' : undefined,
    });

    const { year, month, day, hour, minute } = dateTimeParts;

    initialValue = dateOnly
      ? `${year}-${month}-${day}`
      : `${year}-${month}-${day}T${hour}:${minute}`;
    inputValue = initialValue;

    if (!currentValue) {
      setCurrentValue();
    }
  });

  $: {
    if (inputValue && inputValue !== initialValue) {
      setCurrentValue();
    }
  }
</script>

<div>
  {#if dateOnly}
    <input type="date" {disabled} bind:value={inputValue} />
  {:else}
    <input type="datetime-local" {disabled} bind:value={inputValue} />
  {/if}
</div>

<style lang="scss">
  div {
    display: flex;
    align-items: center;

    input {
      margin-right: auto;

      &:disabled {
        opacity: 0.4;
      }
    }

    :global(button) {
      margin: 4px;
    }
  }
</style>
