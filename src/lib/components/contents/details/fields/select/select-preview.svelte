<!--
  @component
  Implement the preview for a Select field.
  @see https://decapcms.org/docs/widgets/#Select
  @see https://sveltiacms.app/en/docs/fields/select
-->
<script>
  import { getPreviewLabels } from '$lib/services/contents/fields/select/helpers';
  import { getCanonicalLocale, getDirection, getListFormatter } from '$lib/services/contents/i18n';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { SelectField, SelectFieldValue } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {SelectField} fieldConfig Field configuration.
   * @property {SelectFieldValue | SelectFieldValue[] | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const listFormatter = $derived(getListFormatter(locale));
  const labels = $derived(getPreviewLabels({ fieldConfig, currentValue }));
</script>

{#if labels.length}
  <p lang={getCanonicalLocale(locale)} dir={getDirection(locale)}>
    {listFormatter.format(labels)}
  </p>
{/if}
