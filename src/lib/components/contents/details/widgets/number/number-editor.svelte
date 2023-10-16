<!--
  @component
  Implement the editor for the Number widget.
  @see https://decapcms.org/docs/widgets/#number
-->
<script>
  import { NumberInput } from '@sveltia/ui';

  // svelte-ignore unused-export-let
  export let locale = '';

  // svelte-ignore unused-export-let
  export let keyPath = '';

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
  export let disabled = false;

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

  // eslint-disable-next-line jsdoc/require-jsdoc
  const onCurrentValueChange = () => {
    if (currentValue !== undefined && inputValue !== String(currentValue)) {
      inputValue = String(currentValue);
    }
  };

  // eslint-disable-next-line jsdoc/require-jsdoc
  const onInputValueChange = () => {
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

    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  $: {
    void currentValue;
    onCurrentValueChange();
  }

  $: {
    void inputValue;
    onInputValueChange();
  }
</script>

<NumberInput {min} {max} {step} {disabled} bind:value={inputValue} />
