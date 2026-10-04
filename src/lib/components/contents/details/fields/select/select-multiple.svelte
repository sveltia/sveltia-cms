<script>
  import { Checkbox, CheckboxGroup, SelectTags } from '@sveltia/ui';
  import { getContext } from 'svelte';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { updateListFieldForLocales } from '$lib/services/contents/draft/update/list';

  /**
   * @import { FieldEditorContext, SelectFieldSelectorProps } from '$lib/types/private';
   * @import { SelectFieldValue } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {SelectFieldValue[] | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};

  /** @type {SelectFieldSelectorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldId,
    fieldConfig,
    currentValue,
    required = true,
    readonly = false,
    invalid = false,
    options,
    /* eslint-enable prefer-const */
  } = $props();

  const { i18n, max, dropdown_threshold: dropdownThreshold = 5 } = $derived(fieldConfig);

  /**
   * Update the value for the list.
   * @param {(arg: { valueList: any[], expanderStateList: any[] }) => void} manipulate See
   * {@link updateListFieldForLocales}.
   */
  const updateList = (manipulate) => {
    const draft = entryDraft.current;

    // Avoid an error while navigating pages
    /* v8 ignore next 11 */
    if (draft) {
      updateListFieldForLocales({
        draft,
        locale,
        i18n,
        fieldConfig,
        valueStoreKey,
        keyPath,
        manipulate,
      });
    }
  };

  /**
   * Add a value to the list.
   * @param {SelectFieldValue} value Value to be added.
   */
  const addValue = (value) => {
    updateList(({ valueList }) => {
      valueList.push(value);
    });
  };

  /**
   * Remove a value from the list.
   * @param {SelectFieldValue} value Value to be removed.
   */
  const removeValue = (value) => {
    updateList(({ valueList }) => {
      const index = valueList.indexOf(value);

      // A duplicated locale may not have the value; `-1` would remove its last value instead
      if (index > -1) {
        valueList.splice(index, 1);
      }
    });
  };
</script>

{#if options.length > dropdownThreshold}
  <SelectTags
    disabled={readonly}
    {readonly}
    {required}
    {invalid}
    {options}
    {...{ values: /** @type {any} */ (currentValue) }}
    {max}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
    onAddValue={({ detail: { value } }) => {
      addValue(value);
    }}
    onRemoveValue={({ detail: { value } }) => {
      removeValue(value);
    }}
    onReorder={({ detail: { values } }) => {
      updateList(({ valueList }) => {
        valueList.splice(0, valueList.length, ...values);
      });
    }}
  />
{:else}
  <CheckboxGroup aria-labelledby="{fieldId}-label">
    {#each options as { label, value }, index (`${index}-${value}`)}
      <Checkbox
        {label}
        {value}
        {readonly}
        {required}
        {invalid}
        checked={currentValue?.includes(value) ?? false}
        aria-errormessage="{fieldId}-error"
        onChange={({ detail: { checked } }) => {
          if (checked) {
            addValue(value);
          } else {
            removeValue(value);
          }
        }}
      />
    {/each}
  </CheckboxGroup>
{/if}
