<!--
  @component
  Implement the editor for the Relation widget.
  @see https://decapcms.org/docs/widgets/#Relation
-->
<script>
  import SelectEditor from '$lib/components/contents/details/widgets/select/select-editor.svelte';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import { getCollectionFileEntry } from '$lib/services/contents/collection/files';
  import { getOptions } from '$lib/services/contents/widgets/relation/helper';

  /**
   * @import { WidgetEditorProps } from '$lib/types/private';
   * @import { RelationField, SelectField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {RelationField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
   */

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
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
      ? [getCollectionFileEntry(collectionName, fileName)].filter((entry) => !!entry)
      : getEntriesByCollection(collectionName),
  );
  /** @type {SelectField} */
  const selectFieldConfig = $derived({
    ...fieldConfig,
    widget: 'select',
    options: getOptions(locale, fieldConfig, refEntries),
  });
</script>

<div role="none" class="wrapper">
  <SelectEditor
    {locale}
    {keyPath}
    {typedKeyPath}
    {fieldId}
    {fieldLabel}
    fieldConfig={selectFieldConfig}
    bind:currentValue
    {readonly}
    {required}
    {invalid}
    sortOptions={true}
  />
</div>
