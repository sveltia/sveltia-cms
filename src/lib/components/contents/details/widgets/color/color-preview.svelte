<!--
  @component
  Implement the preview for the Color widget.
  @see https://decapcms.org/docs/widgets/#color
-->
<script>
  /**
   * @typedef {object} Props
   * @property {import('$lib/typedefs').ColorField} fieldConfig - Field configuration.
   * @property {string | undefined} currentValue - Field value.
   */

  /** @type {import('$lib/typedefs').WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const { enableAlpha = false } = $derived(fieldConfig);

  /**
   * Cast the given hex value to integer.
   * @param {string} hex - Hex value.
   * @returns {number} Integer value.
   */
  const hexToInt = (hex) => Number.parseInt(`0x${hex}`, 16);

  const rgbaRegex = /^#(?<r>[0-9a-f]{2})(?<g>[0-9a-f]{2})(?<b>[0-9a-f]{2})(?<a>[0-9a-f]{2})?$/;

  const rgb = $derived.by(() => {
    const { r, g, b, a } = currentValue?.match(rgbaRegex)?.groups ?? {};

    return r
      ? `rgb(${hexToInt(r)} ${hexToInt(g)} ${hexToInt(b)}` +
          `${enableAlpha && a ? ` / ${Math.round((hexToInt(a) / 255) * 100)}%` : ''})`
      : '';
  });
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

<style lang="scss">
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
