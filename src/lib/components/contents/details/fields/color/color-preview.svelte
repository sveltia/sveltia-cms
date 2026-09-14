<!--
  @component
  Implement the preview for a Color field.
  @see https://decapcms.org/docs/widgets/#color
  @see https://sveltiacms.app/en/docs/fields/color
-->
<script>
  import { formatHexAsRGB } from '$lib/services/contents/fields/color/helpers';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { ColorField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ColorField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const { enableAlpha = false } = $derived(fieldConfig);
  const rgb = $derived(formatHexAsRGB(currentValue, { enableAlpha }));
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
  <p>
    <span role="none" class="preview">
      <span role="none" class="color" style:background-color={currentValue}></span>
      <span role="none" class="value">{currentValue}</span>
      <span role="none" class="value">{rgb}</span>
    </span>
  </p>
{/if}

<style>
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
