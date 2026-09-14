<!--
  @component
  Implement the editor for a Number field.
  @see https://decapcms.org/docs/widgets/#Number
  @see https://sveltiacms.app/en/docs/fields/number
-->
<script>
  import { NumberInput } from '@sveltia/ui';

  import {
    getNumberFieldValue,
    getNumberInputValue,
  } from '$lib/services/contents/fields/number/helpers';
  import { watch } from '$lib/services/utils/state.svelte';

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

  const { min, max, step = 1 } = $derived(fieldConfig);

  /**
   * Update {@link inputValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    const newValue = getNumberInputValue({ currentValue, fieldConfig });

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
    const newValue = getNumberFieldValue({ inputValue, fieldConfig });

    // Avoid a cycle dependency & infinite loop
    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  watch(
    () => currentValue,
    () => {
      setInputValue();
    },
  );

  watch(
    () => inputValue,
    () => {
      setCurrentValue();
    },
  );
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
