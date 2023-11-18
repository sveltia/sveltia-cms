<!--
  @component
  Implement the preview for the Color widget.
  @see https://decapcms.org/docs/widgets/#color
-->
<script>
  /**
   * @type {LocaleCode}
   */
  // svelte-ignore unused-export-let
  export let locale;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {ColorField}
   */
  // svelte-ignore unused-export-let
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
  <p>
    <span role="none" class="preview">
      <span role="none" class="color" style:background-color={currentValue} />
      <span role="none" class="value">{currentValue}</span>
    </span>
  </p>
{/if}

<style lang="scss">
  .preview {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    .color {
      display: block;
      width: 24px;
      height: 24px;
      border-radius: 24px;
    }
  }
</style>
