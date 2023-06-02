<!--
  @component
  Implement the preview for the Number widget.
  @see https://decapcms.org/docs/widgets/#number
-->
<script>
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  // svelte-ignore unused-export-let
  /**
   * @type {NumberField}
   */
  export let fieldConfig = undefined;
  /**
   * @type {string | number}
   */
  export let currentValue = undefined;
</script>

{#if currentValue !== undefined}
  <p>{Intl.NumberFormat(locale).format(Number(currentValue))}</p>
{/if}
