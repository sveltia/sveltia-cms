<!--
  @component
  Implement the editor for the DataTime and (deprecated) Date widgets.
  @see https://decapcms.org/docs/widgets/#datetime
  @see https://decapcms.org/docs/widgets/#date
  @todo Replace the native `<input>` with a custom component.
-->
<script>
  import {
    getCurrentValue,
    getInputValue,
  } from '$lib/components/contents/details/widgets/date-time/helper';

  /**
   * @type {LocaleCode}
   */
  // svelte-ignore unused-export-let
  export let locale;
  /**
   * @type {string}
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
  /**
   * @type {boolean}
   */
  export let disabled = false;

  $: ({
    // Widget-specific options
    date_format: dateFormat,
    time_format: timeFormat,
  } = fieldConfig);
  $: dateOnly = timeFormat === false;
  $: timeOnly = dateFormat === false;

  /**
   * @type {string}
   */
  let inputValue;

  /**
   * Set the current value. Make sure to prevent a cycle dependency.
   */
  const setCurrentValue = () => {
    const _currentValue = getCurrentValue(inputValue, fieldConfig);

    if (_currentValue !== undefined && _currentValue !== currentValue) {
      currentValue = _currentValue;
    }
  };

  /**
   * Set the input value. Make sure to prevent a cycle dependency.
   */
  const setInputValue = () => {
    const _inputValue = getInputValue(currentValue, fieldConfig);

    if (_inputValue !== undefined && _inputValue !== inputValue) {
      inputValue = _inputValue;
    }
  };

  $: {
    void inputValue;
    setCurrentValue();
  }

  $: {
    void currentValue;
    setInputValue();
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
      color: inherit;
      background-color: transparent;
      font-family: var(--sui-textbox-font-family);

      &:disabled {
        opacity: 0.4;
      }
    }

    :global(button) {
      margin: 4px;
    }
  }
</style>
