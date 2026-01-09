<!--
  @component
  Implement the preview for a Map field.
  @see https://decapcms.org/docs/widgets/#Map
  @see https://sveltiacms.app/en/docs/fields/map
-->
<script>
  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { MapField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MapField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value. Stringified GeoJSON geometry object.
   */

  /** @type {FieldPreviewProps & Props} */
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
