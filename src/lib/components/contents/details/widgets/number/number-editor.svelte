<!--
  @component
  Implement the editor for the Number widget.
  @see https://decapcms.org/docs/widgets/#number
-->
<script>
  import { NumberInput } from '@sveltia/ui';
  import { entryDraft } from '$lib/services/contents/editor';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  /**
   * @type {NumberField}
   */
  export let fieldConfig = undefined;
  /**
   * @type {string | number}
   */
  export let currentValue = undefined;

  $: ({
    i18n,
    // Widget-specific options
    value_type: valueType = 'int',
    min,
    max,
    step = 1,
  } = fieldConfig);
  $: ({ defaultLocale = 'default' } = $entryDraft.collection._i18n);
  $: disabled = i18n === 'duplicate' && locale !== defaultLocale;

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

  // @ts-ignore
  $: onCurrentValueChange(currentValue);
  // @ts-ignore
  $: onInputValueChange(inputValue);
</script>

<NumberInput {min} {max} {step} {disabled} bind:value={inputValue} />
