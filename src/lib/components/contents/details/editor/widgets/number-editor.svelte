<!--
  @component
  Implement the editor for the Number widget.
  @see https://www.netlifycms.org/docs/widgets/#number
-->
<script>
  import { NumberInput } from '@sveltia/ui';
  import { onMount } from 'svelte';
  import { defaultContentLocale } from '$lib/services/config';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({
    i18n,
    // Widget-specific options
    value_type: valueType,
    min,
    max,
    step = 1,
  } = fieldConfig);
  $: disabled = i18n === 'duplicate' && locale !== $defaultContentLocale;

  let mounted = false;
  /** @type {string} */
  let inputValue = '';

  $: {
    if (inputValue !== '' && inputValue !== String(currentValue)) {
      if (
        (valueType === 'int' && Number.isInteger(Number(inputValue))) ||
        (valueType === 'float' && !Number.isNaN(inputValue) && inputValue.includes('.'))
      ) {
        currentValue = Number(inputValue);
      } else {
        currentValue = inputValue;
      }
    }
  }

  $: {
    if (mounted && inputValue === '') {
      currentValue = '';
    }
  }

  onMount(() => {
    if (currentValue) {
      inputValue = String(currentValue);
    }

    mounted = true;
  });
</script>

<NumberInput {min} {max} {step} {disabled} bind:value={inputValue} />
