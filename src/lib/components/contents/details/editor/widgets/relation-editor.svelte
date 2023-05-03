<!--
  @component
  Implement the editor for the Relation widget.
  @see https://www.netlifycms.org/docs/widgets/#relation
  @todo Support search fields.
  @todo Support file collection & wildcard matching.
-->
<script>
  import SelectEditor from '$lib/components/contents/details/editor/widgets/select-editor.svelte';
  import { getCollection, getEntries } from '$lib/services/contents';

  export let locale = '';
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({
    // Widget-specific options
    collection,
    value_field: valueField,
    // search_fields: searchFields,
    // file,
    display_fields: displayFields,
    // multiple = false,
    // min,
    // max,
  } = fieldConfig);
  $: relCollection = getCollection(collection);
  $: refEntries = relCollection ? getEntries(collection) : [];

  $: options = refEntries.map((refEntry) => {
    const { content } = refEntry.locales[locale] || {};

    return {
      label: (displayFields || [valueField])
        .map(
          (fieldName) =>
            content?.[fieldName] ||
            fieldName.replaceAll(/{{(.+?)}}/g, (_match, p1) => content?.[p1] || '') ||
            '',
        )
        .join(' '),
      value: content?.[valueField] || refEntry[valueField.replace(/{{(.+?)}}/, '$1')] || '',
    };
  });
</script>

<SelectEditor {locale} {keyPath} {fieldConfig} bind:currentValue {options} />
