<!--
  @component
  Implement the editor for a Number field.
  @see https://decapcms.org/docs/widgets/#Number
-->
<script>
  import { NumberInput } from '@sveltia/ui';
  import { untrack } from 'svelte';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { NumberField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {NumberField} fieldConfig Field configuration.
   * @property {string | number | null | undefined} currentValue Field value.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {number | undefined} */
  let inputValue = $state();

  const { value_type: valueType = 'int', min, max, step = 1 } = $derived(fieldConfig);
  const isStringOutput = $derived(!['int', 'float'].includes(valueType));
  const isFloatType = $derived(['float', 'float/string'].includes(valueType));

  /**
   * Update {@link inputValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    let newValue = undefined;

    if (currentValue !== undefined) {
      if (typeof currentValue === 'number') {
        newValue = currentValue;
      } else if (typeof currentValue === 'string') {
        if (!currentValue.trim()) {
          newValue = NaN;
        } else if (isFloatType) {
          newValue = Number.parseFloat(currentValue);
        } else {
          newValue = Number.parseInt(currentValue, 10);
        }

        newValue = !Number.isNaN(newValue) ? newValue : undefined;
      }
    }

    // Avoid a cycle dependency & infinite loop
    if (inputValue !== newValue) {
      inputValue = newValue;
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue}. Cast the value according to the
   * `value_type` configuration.
   */
  const setCurrentValue = () => {
    let newValue;

    if (inputValue === undefined) {
      newValue = NaN;
    } else if (isFloatType) {
      newValue = Number.parseFloat(String(inputValue));
    } else {
      newValue = Number.parseInt(String(inputValue), 10);
    }

    if (isStringOutput) {
      newValue = Number.isNaN(newValue) ? '' : String(newValue);
    } else if (Number.isNaN(newValue)) {
      newValue = null;
    }

    // Avoid a cycle dependency & infinite loop
    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  $effect(() => {
    void [currentValue];

    untrack(() => {
      setInputValue();
    });
  });

  $effect(() => {
    void [inputValue];

    untrack(() => {
      setCurrentValue();
    });
  });
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
  onblur={() => {
    // Ensure synchronization on blur
    setInputValue();
  }}
/>
