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
    isFloatType,
  } from '$lib/services/contents/fields/number/helpers';
  import { syncValues } from '$lib/services/utils/state.svelte';

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
  /**
   * Text in the input, which `inputValue` is `undefined` for if it can’t be parsed as a number.
   */
  let inputText = $state('');

  const { min, max, step = 1 } = $derived(fieldConfig);

  /**
   * Get the input value, or the text in the input if it holds something other than a number, so
   * that text is stored and reported as invalid rather than silently stored as an empty value.
   * @returns {number | string | undefined} Input value.
   */
  const getInput = () => (inputValue === undefined && inputText.trim() ? inputText : inputValue);

  // Sync `inputValue` with `currentValue` in both directions, casting the value according to the
  // `value_type` configuration
  const { updateInput } = syncValues(
    () => currentValue,
    (value) => {
      currentValue = value;
    },
    getInput,
    (input) => {
      // A string, the text in the input, is only converted from the stored value when it’s the
      // input already, so it never gets here
      inputValue = /** @type {number | undefined} */ (input);
    },
    (value) => getNumberInputValue({ currentValue: value, fieldConfig, inputValue: getInput() }),
    (input) => getNumberFieldValue({ inputValue: input, fieldConfig }),
  );
</script>

<NumberInput
  bind:value={inputValue}
  {min}
  {max}
  {step}
  fractional={isFloatType(fieldConfig)}
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
  oninput={(event) => {
    inputText = /** @type {HTMLInputElement} */ (event.target).value;
  }}
  onblur={() => {
    // Ensure synchronization on blur
    updateInput();
  }}
/>
