<!--
  @component
  Implement the editor for the Relation widget.
  @see https://decapcms.org/docs/widgets/#relation
-->
<script>
  import SelectEditor from '$lib/components/contents/details/widgets/select/select-editor.svelte';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import { getFile } from '$lib/services/contents/collection/files';
  import { getOptions } from '$lib/services/contents/widgets/relation/helper';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  export let keyPath;
  /**
   * @type {string}
   */
  export let fieldId;
  /**
   * @type {string}
   */
  export let fieldLabel;
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
  export let readonly = false;
  /**
   * @type {boolean}
   */
  export let required = false;
  /**
   * @type {boolean}
   */
  export let invalid = false;

  $: ({
    // Widget-specific options
    collection: collectionName,
    file: fileName,
  } = fieldConfig);

  $: refEntries = fileName
    ? /** @type {Entry[]} */ ([getFile(collectionName, fileName)].filter(Boolean))
    : getEntriesByCollection(collectionName);
  $: options = getOptions(locale, fieldConfig, refEntries);
</script>

<div role="none" class="wrapper">
  <SelectEditor
    {locale}
    {keyPath}
    {fieldId}
    {fieldLabel}
    fieldConfig={{ ...fieldConfig, options }}
    bind:currentValue
    {readonly}
    {required}
    {invalid}
    sortOptions={true}
  />
</div>
