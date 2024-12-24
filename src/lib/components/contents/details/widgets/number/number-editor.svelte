<!--
  @component
  Implement the editor for the Number widget.
  @see https://decapcms.org/docs/widgets/#number
-->
<script>
  import { NumberInput, TextInput } from '@sveltia/ui';

  /**
   * @type {LocaleCode}
   */
  // svelte-ignore unused-export-let
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {string}
   */
  export let fieldId;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldLabel;
  /**
   * @type {NumberField}
   */
  export let fieldConfig;
  /**
   * @type {string | number}
   */
  export let currentValue;
  /**
   * @type {boolean}
   */
  export let readonly = false;
  /**
   * @type {boolean}
   */
  export let required = false;
  /**
   * @type {boolean}
   */
  export let invalid = false;

  $: ({
    // Widget-specific options
    value_type: valueType = 'int',
    min,
    max,
    step = 1,
  } = fieldConfig);

  $: isNumeric = valueType === 'int' || valueType === 'float';

  /** @type {number | undefined} */
  let numInputValue;
  /** @type {string} */
  let strInputValue = '';

  /**
   * Update {@link numInputValue} or {@link strInputValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    // Avoid a cycle dependency & infinite loop
    if (currentValue !== undefined) {
      if (isNumeric && numInputValue !== currentValue) {
        const value = Number(currentValue);

        numInputValue = !Number.isNaN(value) ? value : undefined;
      }

      if (!isNumeric && strInputValue !== currentValue) {
        strInputValue = String(currentValue);
      }
    }
  };

  /**
   * Update {@link currentValue} based on {@link numInputValue} or {@link strInputValue}. Cast the
   * value according to the `value_type` configuration.
   */
  const setCurrentValue = () => {
    let newValue;

    if (valueType === 'int') {
      newValue = Number.parseInt(isNumeric ? String(numInputValue) : strInputValue, 10);
    } else if (valueType === 'float') {
      newValue = Number.parseFloat(isNumeric ? String(numInputValue) : strInputValue);
    } else {
      newValue = strInputValue;
    }

    if (isNumeric && Number.isNaN(newValue)) {
      newValue = '';
    }

    // Avoid a cycle dependency & infinite loop
    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  $: {
    void currentValue;
    setInputValue();
  }

  $: {
    void strInputValue;
    setCurrentValue();
  }

  $: {
    void numInputValue;
    setCurrentValue();
  }
</script>

{#if isNumeric}
  <NumberInput
    bind:value={numInputValue}
    {min}
    {max}
    {step}
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
  />
{:else}
  <TextInput
    bind:value={strInputValue}
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
  />
{/if}
