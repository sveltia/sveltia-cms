<script>
  import { Checkbox, CheckboxGroup, SelectTags } from '@sveltia/ui';
  import { entryDraft } from '$lib/services/contents/draft';
  import { updateListField } from '$lib/services/contents/draft/update';

  /** @type {LocaleCode} */
  export let locale;
  /** @type {FieldKeyPath} */
  export let keyPath;
  /** @type {string} */
  export let fieldId;
  /** @type {SelectField} */
  export let fieldConfig;
  /** @type {string[]} */
  export let currentValue;
  /** @type {boolean} */
  export let readonly = false;
  /** @type {boolean} */
  export let required = false;
  /** @type {boolean} */
  export let invalid = false;
  /** @type {{ label: string, value: string, searchValue?: string }[]} */
  export let options;

  $: ({ i18n, max, dropdown_threshold = 5 } = fieldConfig);

  /**
   * Update the value for the list.
   * @param {(arg: { valueList: any[], expanderStateList: any[] }) => void} manipulate -
   * See {@link updateListField}.
   */
  const updateList = (manipulate) => {
    // Avoid an error while navigating pages
    if ($entryDraft) {
      Object.keys($entryDraft.currentValues ?? {}).forEach((_locale) => {
        if (!(i18n !== 'duplicate' && _locale !== locale)) {
          updateListField(_locale, keyPath, manipulate);
        }
      });
    }
  };

  /**
   * Add a value to the list.
   * @param {string} value - Value to be added.
   */
  const addValue = (value) => {
    updateList(({ valueList }) => {
      valueList.push(value);
    });
  };

  /**
   * Remove a value from the list.
   * @param {string} value - Value to be removed.
   */
  const removeValue = (value) => {
    updateList(({ valueList }) => {
      valueList.splice(valueList.indexOf(value), 1);
    });
  };
</script>

{#if options.length > dropdown_threshold}
  <SelectTags
    disabled={readonly}
    {readonly}
    {required}
    {invalid}
    {options}
    values={currentValue}
    {max}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
    onAddValue={({ detail: { value } }) => {
      addValue(value);
    }}
    onRemoveValue={({ detail: { value } }) => {
      removeValue(value);
    }}
  />
{:else}
  <CheckboxGroup aria-labelledby="{fieldId}-label">
    {#each options as { label, value } (value)}
      <Checkbox
        {label}
        {value}
        {readonly}
        {required}
        {invalid}
        checked={currentValue.includes(value)}
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
