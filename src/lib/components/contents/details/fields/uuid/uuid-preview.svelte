<!--
  @component
  Implement the preview for a UUID field.
  @see https://staticjscms.netlify.app/docs/widget-uuid
  @see https://sveltiacms.app/en/docs/fields/uuid
-->
<script>
  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { UuidField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {UuidField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
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
