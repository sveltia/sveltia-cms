<!--
  @component
  Implement the editor for the Number widget.
  @see https://decapcms.org/docs/widgets/#number
-->
<script>
  import { NumberInput, TextInput } from '@sveltia/ui';
  import { untrack } from 'svelte';

  /**
   * @import { WidgetEditorProps } from '$lib/types/private';
   * @import { NumberField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {NumberField} fieldConfig Field configuration.
   * @property {string | number | null | undefined} currentValue Field value.
   */

  /** @type {WidgetEditorProps & Props} */
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
  let numInputValue = $state();
  let strInputValue = $state('');

  const { value_type: valueType = 'int', min, max, step = 1 } = $derived(fieldConfig);
  const isNumeric = $derived(valueType === 'int' || valueType === 'float');

  /**
   * Update {@link numInputValue} or {@link strInputValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    // Avoid a cycle dependency & infinite loop
    if (currentValue !== undefined) {
      if (isNumeric && numInputValue !== currentValue) {
        if (typeof currentValue === 'number') {
          numInputValue = currentValue;
        } else if (typeof currentValue === 'string') {
          const value = currentValue.trim() ? Number(currentValue) : NaN;

          numInputValue = !Number.isNaN(value) ? value : undefined;
        } else {
          numInputValue = undefined;
        }
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

    if (isNumeric) {
      if (numInputValue === undefined) {
        newValue = NaN;
      } else if (valueType === 'int') {
        newValue = Number.parseInt(isNumeric ? String(numInputValue) : strInputValue, 10);
      } else {
        newValue = Number.parseFloat(isNumeric ? String(numInputValue) : strInputValue);
      }
    } else {
      newValue = strInputValue;
    }

    if (isNumeric && Number.isNaN(newValue)) {
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
    void [strInputValue];

    untrack(() => {
      setCurrentValue();
    });
  });

  $effect(() => {
    void [numInputValue];

    untrack(() => {
      setCurrentValue();
    });
  });
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
