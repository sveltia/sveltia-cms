<!--
  @component
  Implement the preview for the experimental Compute widget.
-->
<script>
  /**
   * @typedef {object} Props
   * @property {StringField} fieldConfig - Field configuration.
   * @property {string | number} [currentValue] - Field value.
   */

  /** @type {WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<p lang={locale} dir="auto">{currentValue}</p>
