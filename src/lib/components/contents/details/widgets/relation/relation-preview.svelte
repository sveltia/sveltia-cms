<!--
  @component
  Implement the preview for the Relation widget.
  @see https://decapcms.org/docs/widgets/#relation
-->
<script>
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import { getFile } from '$lib/services/contents/collection/files';
  import { getListFormatter } from '$lib/services/contents/i18n';
  import { getOptions } from '$lib/services/contents/widgets/relation/helper';

  /**
   * @typedef {object} Props
   * @property {import('$lib/typedefs/public').RelationField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
   */

  /** @type {import('$lib/typedefs/private').WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    // Widget-specific options
    collection: collectionName,
    file: fileName,
    multiple = false,
    value_field: valueField,
  } = $derived(fieldConfig);
  const listFormatter = $derived(getListFormatter(locale));
  const refEntries = $derived(
    fileName
      ? /** @type {import('$lib/typedefs/private').Entry[]} */ (
          [getFile(collectionName, fileName)].filter(Boolean)
        )
      : getEntriesByCollection(collectionName),
  );
  const options = $derived(getOptions(locale, fieldConfig, refEntries));
  const refValues = $derived(
    (multiple ? /** @type {string[]} */ (currentValue) : /** @type {string[]} */ ([currentValue]))
      .filter((value) => value !== undefined)
      .map((value) => {
        const label = options.find((option) => option.value === value)?.label;

        if (label && label !== value) {
          if (['slug', '{{slug}}', '{{fields.slug}}'].includes(valueField)) {
            return label;
          }

          return `${label} (${value})`;
        }

        return value;
      }),
  );
</script>

{#if refValues.length}
  <p lang={locale} dir="auto">{listFormatter.format(refValues)}</p>
{/if}
