<!--
  @component
  Implement the editor for the Relation widget.
  @see https://decapcms.org/docs/widgets/#relation
  @todo Support search fields.
-->
<script>
  import { getOptions } from '$lib/components/contents/details/widgets/relation/helper';
  import SelectEditor from '$lib/components/contents/details/widgets/select/select-editor.svelte';
  import { getEntriesByCollection, getFile } from '$lib/services/contents';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {string}
   */
  export let keyPath;
  /**
   * @type {RelationField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;
  /**
   * @type {boolean}
   */
  export let disabled = false;

  $: ({
    // Widget-specific options
    collection: collectionName,
    file: fileName,
    // search_fields: searchFields,
  } = fieldConfig);

  $: refEntries = fileName
    ? [getFile(collectionName, fileName)]
    : getEntriesByCollection(collectionName);
  $: options = getOptions(locale, fieldConfig, refEntries);
</script>

<SelectEditor
  {locale}
  {keyPath}
  fieldConfig={{ ...fieldConfig, options }}
  bind:currentValue
  {disabled}
  sortOptions={true}
/>
