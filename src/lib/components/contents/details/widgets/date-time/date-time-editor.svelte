<!--
  @component
  Implement the editor for the DataTime and (deprecated) Date widgets.
  @see https://decapcms.org/docs/widgets/#datetime
  @see https://decapcms.org/docs/widgets/#date
  @todo Replace the native `<input>` with a custom component.
-->
<script>
  import moment from 'moment';
  import { onMount } from 'svelte';
  import { entryDraft } from '$lib/services/contents/editor';
  import { getDateTimeParts } from '$lib/services/utils/datetime';

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
    required = true,
    i18n,
    // Widget-specific options
    format,
    date_format: dateFormat,
    time_format: timeFormat,
    picker_utc: pickerUTC = false,
  } = fieldConfig);
  $: ({ defaultLocale = 'default' } = $entryDraft.collection._i18n);
  $: disabled = i18n === 'duplicate' && locale !== defaultLocale;
  $: dateOnly = timeFormat === false;
  $: timeOnly = dateFormat === false;

  /**
   * @type {string}
   */
  let initialValue = undefined;
  /**
   * @type {string}
   */
  let inputValue = undefined;

  /**
   * Set the current value given the input value.
   */
  const setCurrentValue = () => {
    if (timeOnly) {
      currentValue = inputValue;
    } else {
      try {
        currentValue = format
          ? (pickerUTC ? moment.utc(inputValue) : moment(inputValue)).format(format)
          : new Date(inputValue).toISOString();
      } catch {
        currentValue = undefined;
      }
    }
  };

  onMount(() => {
    if (required || currentValue) {
      if (timeOnly) {
        initialValue = currentValue || '';
      } else {
        const { year, month, day, hour, minute } = getDateTimeParts({
          date: currentValue ? moment(currentValue, format).toDate() : new Date(),
          timeZone: pickerUTC ? 'UTC' : undefined,
        });

        initialValue = dateOnly
          ? `${year}-${month}-${day}`
          : `${year}-${month}-${day}T${hour}:${minute}`;
      }

      inputValue = initialValue;

      if (!currentValue) {
        setCurrentValue();
      }
    }
  });

  $: {
    if (inputValue !== undefined && inputValue !== initialValue) {
      setCurrentValue();
    }
  }
</script>

<div>
  {#if dateOnly}
    <input type="date" {disabled} bind:value={inputValue} />
  {:else if timeOnly}
    <input type="time" {disabled} bind:value={inputValue} />
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
