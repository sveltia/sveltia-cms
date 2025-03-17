<!--
  @component
  Implement the editor for the experimental Compute widget. Note that this editor is hidden in
  `FieldEditor` but still needed to compute the value.
-->
<script>
  import { TextInput } from '@sveltia/ui';
  import { untrack } from 'svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getFieldDisplayValue } from '$lib/services/contents/entry/fields';
  import { getListFormatter } from '$lib/services/contents/i18n';

  /**
   * @import { WidgetEditorProps } from '$lib/typedefs/private';
   * @import { ComputeField } from '$lib/typedefs/public';
   */

  /**
   * @typedef {object} Props
   * @property {ComputeField} fieldConfig Field configuration.
   * @property {string | number | undefined} currentValue Field value.
   */

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  const { value: valueTemplate = '' } = $derived(fieldConfig);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const fileName = $derived($entryDraft?.fileName);
  const valueMap = $derived($state.snapshot($entryDraft?.currentValues[locale]) ?? {});
  const listFormatter = $derived(getListFormatter(locale));

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
  const setCurrentValue = () => {
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

  $effect(() => {
    void valueMap;

    untrack(() => {
      setCurrentValue();
    });
  });
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
