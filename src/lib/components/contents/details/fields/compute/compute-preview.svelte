<!--
  @component
  Implement the preview for a Compute field.
-->
<script>
  import { formatComputedValue } from '$lib/services/contents/fields/compute/helpers';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { ComputeField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ComputeField} fieldConfig Field configuration.
   * @property {string | number | null | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const canonicalLocale = $derived(getCanonicalLocale(locale));
</script>

<p lang={canonicalLocale} dir={getDirection(locale)}>
  {formatComputedValue({ value: currentValue, fieldConfig, canonicalLocale })}
</p>
