<!--
  @component
  Implement the editor for the Number widget.
  @see https://decapcms.org/docs/widgets/#number
-->
<script>
  import { NumberInput } from '@sveltia/ui';

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

  /**
   * @type {string}
   */
  let inputValue = '';

  /**
   * Update {@link inputValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    // Avoid a cycle dependency & infinite loop
    if (currentValue !== undefined && inputValue !== String(currentValue)) {
      inputValue = String(currentValue);
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue}. Cast the value according to the
   * `value_type` configuration.
   */
  const setCurrentValue = () => {
    let newValue;

    if (valueType === 'int') {
      newValue = Number.parseInt(inputValue, 10);
    } else if (valueType === 'float') {
      newValue = Number.parseFloat(inputValue);
    } else {
      newValue = inputValue;
    }

    if ((valueType === 'int' || valueType === 'float') && Number.isNaN(newValue)) {
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
    void inputValue;
    setCurrentValue();
  }
</script>

<NumberInput
  bind:value={inputValue}
  {min}
  {max}
  {step}
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
