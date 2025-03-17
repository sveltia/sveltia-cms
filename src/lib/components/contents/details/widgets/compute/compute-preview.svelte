<!--
  @component
  Implement the preview for the experimental Compute widget.
-->
<script>
  /**
   * @import { WidgetPreviewProps } from '$lib/typedefs/private';
   * @import { StringField } from '$lib/typedefs/public';
   */

  /**
   * @typedef {object} Props
   * @property {StringField} fieldConfig Field configuration.
   * @property {string | number | undefined} currentValue Field value.
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
