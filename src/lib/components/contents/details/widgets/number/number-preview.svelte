<!--
  @component
  Implement the preview for the Number widget.
  @see https://decapcms.org/docs/widgets/#number
-->
<script>
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

  $: ({
    // Widget-specific options
    value_type: valueType = 'int',
  } = fieldConfig);
</script>

{#if currentValue === undefined || currentValue === ''}
  <!--  -->
{:else if valueType === 'int' || valueType === 'float'}
  <p>{Intl.NumberFormat(locale).format(Number(currentValue))}</p>
{:else}
  <p>{currentValue}</p>
{/if}
