<!--
  @component
  Implement the preview for the Text widget.
  @see https://decapcms.org/docs/widgets/#text
-->
<script>
  /**
   * @typedef {object} Props
   * @property {import('$lib/typedefs').TextField} fieldConfig - Field configuration.
   * @property {string | undefined} currentValue - Field value.
   */

  /** @type {import('$lib/typedefs').WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
  <p lang={locale} dir="auto">{currentValue}</p>
{/if}

<style lang="scss">
  p {
    white-space: pre-wrap;
  }
</style>
