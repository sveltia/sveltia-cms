<!--
  @component
  Implement the preview for the Map widget.
  @see https://decapcms.org/docs/widgets/#map
-->
<script>
  /**
   * @import { WidgetPreviewProps } from '$lib/types/private';
   * @import { MapField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MapField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value. Stringified GeoJSON geometry object.
   */

  /** @type {WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if currentValue}
  <pre>{currentValue}</pre>
{/if}

<style lang="scss">
  pre {
    white-space: pre-wrap;
  }
</style>
