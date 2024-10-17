<!--
  @component
  Implement the preview for the Text widget.
  @see https://decapcms.org/docs/widgets/#text
-->
<script>
  /**
   * @type {LocaleCode}
   */
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
  <p lang={locale} dir="auto">{currentValue}</p>
{/if}

<style lang="scss">
  p {
    white-space: pre-wrap;
  }
</style>
