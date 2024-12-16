<!--
  @component
  Implement the editor for the experimental Compute widget. Note that this editor is hidden in
  `FieldEditor` but still needed to compute the value.
-->
<script>
  import { TextInput } from '@sveltia/ui';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getFieldDisplayValue } from '$lib/services/contents/entry/fields';
  import { getListFormatter } from '$lib/services/contents/i18n';

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
  // svelte-ignore unused-export-let
  export let fieldLabel;
  /**
   * @type {ComputeField}
   */
  export let fieldConfig;
  /**
   * @type {string | number}
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
  $: listFormatter = getListFormatter(locale);

  /**
   * Get a list index found in the `keyPath`.
   * @returns {number | undefined} Index.
   * @see https://github.com/sveltia/sveltia-cms/issues/172
   */
  const getIndex = () => {
    const [index] = keyPath.split('.').splice(-2, 1);

    return index?.match(/^\d+$/) ? Number(index) : undefined;
  };

  /**
   * Update {@link currentValue} based on the current values.
   */
  const updateCurrentValue = () => {
    // Check if the `keyPath` is valid, otherwise a list item containing this compute field cannot
    // be removed due to the `currentValue` update below
    if (!Object.keys(valueMap).includes(keyPath)) {
      return;
    }

    const newValue = (() => {
      if (valueTemplate === '{{index}}') {
        return getIndex() ?? '';
      }

      return valueTemplate.replaceAll(/{{(.+?)}}/g, (_match, tagName) => {
        if (tagName === 'index') {
          return String(getIndex() ?? '');
        }

        if (!tagName.startsWith('fields.')) {
          return '';
        }

        const value = getFieldDisplayValue({
          collectionName,
          fileName,
          valueMap,
          keyPath: tagName.replace(/^fields\./, ''),
          locale,
        });

        return Array.isArray(value) ? listFormatter.format(value) : String(value);
      });
    })();

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
  value={String(currentValue)}
  flex
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
