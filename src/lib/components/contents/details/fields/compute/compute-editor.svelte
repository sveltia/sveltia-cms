<!--
  @component
  Implement the editor for a Compute field. Note that this editor is hidden in `FieldEditor` but
  still needed to compute the value.
-->
<script>
  import { TextInput } from '@sveltia/ui';
  import { getContext, untrack } from 'svelte';

  import { replaceTemplateTags } from '$lib/services/common/template';
  import { applyTransformations, parseTransformations } from '$lib/services/common/transformations';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { getFieldDisplayValue } from '$lib/services/contents/entry/fields';
  import { hasSubtree } from '$lib/services/contents/entry/subtree';
  import { getListFormatter } from '$lib/services/contents/i18n';
  import { isNumeric } from '$lib/services/utils/number';

  /**
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import { ComputeField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ComputeField} fieldConfig Field configuration.
   * @property {string | number | undefined} currentValue Field value.
   */

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};

  /** @type {FieldEditorProps & Props} */
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
  const isIndexFile = $derived($entryDraft?.isIndexFile ?? false);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const fileName = $derived($entryDraft?.fileName);
  const valueMap = $derived(getValueMapSnapshot($entryDraft, locale, valueStoreKey));
  const listFormatter = $derived(getListFormatter(locale));

  /**
   * Get a list index found in the `keyPath`.
   * @returns {number | undefined} Index.
   * @see https://github.com/sveltia/sveltia-cms/issues/172
   */
  const getIndex = () => {
    const [index] = keyPath.split('.').splice(-2, 1);

    return index && isNumeric(index) ? Number(index) : undefined;
  };

  /**
   * Check whether the object or list item containing this field is still part of the entry. The
   * computed value is written back to the draft below, so a field left over from a removed list
   * item would recreate the item’s key path and make the item impossible to remove.
   *
   * The field’s own key path can’t answer this: it’s missing whenever the field has yet to hold
   * anything, which is the case for a field added to the configuration after the entry was written
   * and for one inside a rich text editor component, where missing values are deliberately not
   * filled in. Such a field has to compute its first value, not skip it.
   * @returns {boolean} Result. Always `true` for a root-level field, which has no container.
   */
  const isContainerAlive = () => {
    const index = keyPath.lastIndexOf('.');

    return index === -1 || hasSubtree(valueMap, keyPath.slice(0, index));
  };

  /**
   * Update {@link currentValue} based on the current values.
   */
  const setCurrentValue = () => {
    if (!isContainerAlive()) {
      return;
    }

    const newValue = (() => {
      if (valueTemplate === '{{index}}') {
        return getIndex() ?? '';
      }

      return replaceTemplateTags(valueTemplate, (_match, placeholder) => {
        const { value: tagName, transformations } = parseTransformations(placeholder);

        if (tagName === 'index') {
          return String(getIndex() ?? '');
        }

        if (!tagName.startsWith('fields.')) {
          return '';
        }

        let value = getFieldDisplayValue({
          collectionName,
          fileName,
          valueMap,
          keyPath: tagName.replace(/^fields\./, ''),
          locale,
          isIndexFile,
        });

        value = Array.isArray(value) ? listFormatter.format(value) : String(value);

        if (transformations.length) {
          return applyTransformations({ value, transformations, locale });
        }

        return value;
      });
    })();

    // Make sure to avoid infinite loops
    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  $effect(() => {
    void [valueMap];

    untrack(() => {
      setCurrentValue();
    });
  });
</script>

<TextInput
  dir="auto"
  value={String(currentValue)}
  flex
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
