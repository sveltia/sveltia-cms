<!--
  @component
  Implement the editor for the experimental Compute widget. Note that this editor is hidden in
  `FieldEditor` but still needed to compute the value.
-->
<script>
  import { TextInput } from '@sveltia/ui';
  import { entryDraft } from '$lib/services/contents/editor';
  import { getFieldDisplayValue } from '$lib/services/contents/entry';
  import { getCanonicalLocale } from '$lib/services/contents/i18n';

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
   * @type {string}
   */
  export let fieldId;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldLabel;
  /**
   * @type {ComputeField}
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
    value: valueTemplate = '',
  } = fieldConfig);

  $: ({ collectionName, fileName, currentValues } = $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: valueMap = currentValues[locale];
  $: canonicalLocale = getCanonicalLocale(locale);
  $: listFormatter = new Intl.ListFormat(canonicalLocale, { style: 'narrow', type: 'conjunction' });

  /**
   * Update {@link currentValue} based on the current values.
   */
  const updateCurrentValue = () => {
    const newValue = valueTemplate.replaceAll(/{{fields\.(.+?)}}/g, (_match, _fieldName) => {
      const value = getFieldDisplayValue({
        collectionName,
        fileName,
        valueMap,
        keyPath: _fieldName,
        locale,
      });

      return Array.isArray(value) ? listFormatter.format(value) : String(value);
    });

    // Make sure to avoid infinite loops
    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  $: {
    void valueMap;
    updateCurrentValue();
  }
</script>

<TextInput
  value={currentValue}
  flex
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
