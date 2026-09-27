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

  const { min, max, step = 1 } = $derived(fieldConfig);

  // Sync `inputValue` with `currentValue` in both directions, casting the value according to the
  // `value_type` configuration
  const { updateInput } = syncValues(
    () => currentValue,
    (value) => {
      currentValue = value;
    },
    () => inputValue,
    (input) => {
      inputValue = input;
    },
    (value) => getNumberInputValue({ currentValue: value, fieldConfig }),
    (input) => getNumberFieldValue({ inputValue: input, fieldConfig }),
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
    updateInput();
  }}
/>
