<!--
  @component
  Implement the preview for a Relation field.
  @see https://decapcms.org/docs/widgets/#Relation
  @see https://sveltiacms.app/en/docs/fields/relation
-->
<script>
  import { getOptions, getRefEntries } from '$lib/services/contents/fields/relation/helpers';
  import { getPreviewLabels } from '$lib/services/contents/fields/relation/helpers/preview';
  import { getCanonicalLocale, getDirection, getListFormatter } from '$lib/services/contents/i18n';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { RelationField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {RelationField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
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
  const refEntries = $derived(getRefEntries(fieldConfig));
  const options = $derived(getOptions({ locale, fieldConfig, refEntries }));
  const refValues = $derived(getPreviewLabels({ fieldConfig, currentValue, options }));
</script>

{#if refValues.length}
  <p lang={getCanonicalLocale(locale)} dir={getDirection(locale)}>
    {listFormatter.format(refValues)}
  </p>
{/if}
