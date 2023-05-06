<!--
  @component
  Implement the editor for the Number widget.
  @see https://decapcms.org/docs/widgets/#number
-->
<script>
  import { NumberInput } from '@sveltia/ui';
  import { defaultContentLocale } from '$lib/services/config';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({
    i18n,
    // Widget-specific options
    value_type: valueType = 'int',
    min,
    max,
    step = 1,
  } = fieldConfig);
  $: disabled = i18n === 'duplicate' && locale !== $defaultContentLocale;

  /** @type {string} */
  let inputValue = '';

  // eslint-disable-next-line jsdoc/require-jsdoc
  const onCurrentValueChange = () => {
    if (currentValue !== undefined && inputValue !== String(currentValue)) {
      inputValue = String(currentValue);
    }
  };

  // eslint-disable-next-line jsdoc/require-jsdoc
  const onInputValueChange = () => {
    let _currentValue = undefined;

    if (inputValue === '') {
      _currentValue = '';
    } else if (
      (valueType === 'int' && Number.isInteger(Number(inputValue))) ||
      (valueType === 'float' && !Number.isNaN(inputValue) && inputValue.includes('.'))
    ) {
      _currentValue = Number(inputValue);
    } else {
      _currentValue = inputValue;
    }

    if (_currentValue !== undefined && currentValue !== _currentValue) {
      currentValue = _currentValue;
    }
  };

  $: onCurrentValueChange(currentValue);
  $: onInputValueChange(inputValue);
</script>

<NumberInput {min} {max} {step} {disabled} bind:value={inputValue} />
