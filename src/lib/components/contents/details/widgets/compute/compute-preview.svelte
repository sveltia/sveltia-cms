<!--
  @component
  Implement the preview for the experimental Compute widget.
-->
<script>
  /**
   * @typedef {object} Props
   * @property {import('$lib/typedefs').StringField} fieldConfig - Field configuration.
   * @property {string | number | undefined} currentValue - Field value.
   */

  /** @type {import('$lib/typedefs').WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<p lang={locale} dir="auto">{currentValue}</p>
