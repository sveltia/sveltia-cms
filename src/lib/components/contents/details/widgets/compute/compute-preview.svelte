<!--
  @component
  Implement the preview for the experimental Compute widget.
-->
<script>
  import { getCanonicalLocale } from '$lib/services/contents/i18n';

  /**
   * @import { WidgetPreviewProps } from '$lib/types/private';
   * @import { StringField } from '$lib/types/public';
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

<p lang={getCanonicalLocale(locale)} dir="auto">{currentValue}</p>
