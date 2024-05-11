<!--
  @component
  Implement the preview for the UUID widget.
  @see https://decapcms.org/docs/widgets/#uuid
-->
<script>
  /**
   * @type {LocaleCode}
   */
  // svelte-ignore unused-export-let
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {TextField}
   */
  // svelte-ignore unused-export-let
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
  <p>{currentValue}</p>
{/if}

<style lang="scss">
  p {
    font-family: var(--sui-font-family-monospace);
  }
</style>
