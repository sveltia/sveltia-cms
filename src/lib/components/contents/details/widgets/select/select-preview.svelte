<!--
  @component
  Implement the preview for the Select widget.
  @see https://decapcms.org/docs/widgets/#select
-->
<script>
  import { isObjectArray } from '@sveltia/utils/array';
  import { getListFormatter } from '$lib/services/contents/i18n';

  /**
   * @typedef {object} Props
   * @property {import('$lib/typedefs').SelectField} fieldConfig - Field configuration.
   * @property {string | string[] | undefined} currentValue - Field value.
   */

  /** @type {import('$lib/typedefs').WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const { options, multiple } = $derived(fieldConfig);
  const hasLabels = $derived(isObjectArray(options));
  const listFormatter = $derived(getListFormatter(locale));

  /**
   * Get the display label by value.
   * @param {any} value - Value.
   * @returns {string} Label.
   */
  const getLabel = (value) =>
    hasLabels
      ? /** @type {{ label: string, value: string }[]} */ (options).find((o) => o.value === value)
          ?.label || value
      : value;
</script>

{#if multiple && Array.isArray(currentValue) && currentValue.length}
  <p lang={locale} dir="auto">{listFormatter.format(currentValue.map(getLabel).sort())}</p>
{:else if currentValue !== undefined}
  <p lang={locale} dir="auto">{getLabel(currentValue)}</p>
{/if}
