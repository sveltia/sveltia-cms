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
   * @typedef {object} Props
   * @property {RelationField} fieldConfig - Field configuration.
   * @property {string | string[] | undefined} currentValue - Field value.
   */

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldId,
    fieldLabel,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    // Widget-specific options
    collection: collectionName,
    file: fileName,
  } = $derived(fieldConfig);
  const refEntries = $derived(
    fileName
      ? /** @type {Entry[]} */ ([getFile(collectionName, fileName)].filter(Boolean))
      : getEntriesByCollection(collectionName),
  );
  const options = $derived(getOptions(locale, fieldConfig, refEntries));
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
