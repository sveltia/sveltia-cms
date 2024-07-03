<!--
  @component
  Implement the preview for the Relation widget.
  @see https://decapcms.org/docs/widgets/#relation
-->
<script>
  import { getOptions } from '$lib/components/contents/details/widgets/relation/helper';
  import { getEntriesByCollection, getFile } from '$lib/services/contents';
  import { getListFormatter } from '$lib/services/contents/i18n';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {RelationField}
   */
  export let fieldConfig;
  /**
   * @type {string | string[]}
   */
  export let currentValue;

  $: ({
    // Widget-specific options
    collection: collectionName,
    file: fileName,
    multiple = false,
    value_field: valueField,
  } = fieldConfig);

  $: refEntries = fileName
    ? /** @type {Entry[]} */ ([getFile(collectionName, fileName)].filter(Boolean))
    : getEntriesByCollection(collectionName);
  $: options = getOptions(locale, fieldConfig, refEntries);

  $: refValues = (
    multiple ? /** @type {string[]} */ (currentValue) : /** @type {string[]} */ ([currentValue])
  )
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
    });

  $: listFormatter = getListFormatter(locale);
</script>

{#if refValues.length}
  <p>{listFormatter.format(refValues)}</p>
{/if}
