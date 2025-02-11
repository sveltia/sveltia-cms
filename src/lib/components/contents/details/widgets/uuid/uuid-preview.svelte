<!--
  @component
  Implement the preview for the UUID widget.
  @see https://decapcms.org/docs/widgets/#uuid
-->
<script>
  /**
   * @typedef {object} Props
   * @property {TextField} fieldConfig - Field configuration.
   * @property {string} [currentValue] - Field value.
   */

  /** @type {WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
  <p>{currentValue}</p>
{/if}

<style lang="scss">
  p {
    font-family: var(--sui-font-family-monospace);
  }
</style>
