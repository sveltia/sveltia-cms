<!--
  @component
  Implement the editor for a Select field.
  @see https://decapcms.org/docs/widgets/#Select
  @see https://sveltiacms.app/en/docs/fields/select
-->
<script>
  import { isObject } from '@sveltia/utils/object';

  import SelectMultiple from '$lib/components/contents/details/fields/select/select-multiple.svelte';
  import SelectSingle from '$lib/components/contents/details/fields/select/select-single.svelte';
  import { createStableDerivedState } from '$lib/services/utils/state.svelte';

  /**
   * @import { FieldEditorProps, SelectFieldSelectorOption } from '$lib/types/private';
   * @import { SelectField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {SelectField} fieldConfig Field configuration.
   * @property {any} currentValue Field value.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    locale,
    keyPath,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
  } = $props();

  const {
    // Field type-specific options
    options: fieldOptions,
    multiple,
  } = $derived(fieldConfig);
  const Select = $derived(multiple ? SelectMultiple : SelectSingle);
  /**
   * Selector options. A Relation field hands over a new list whenever anything in the entry
   * changes, so the list is kept as long as it holds the same options, and a different list means
   * they have changed. The selector doesn’t follow a change to the options, so it’s rendered again
   * then, which is cheaper to tell by the identity of the list than by serializing every option.
   */
  const options = createStableDerivedState(() =>
    fieldOptions.map(
      (option) =>
        /** @type {SelectFieldSelectorOption} */ (
          isObject(option) ? option : { label: option, value: option }
        ),
    ),
  );
</script>

{#key options.current}
  <Select
    {locale}
    {keyPath}
    {fieldId}
    {fieldConfig}
    bind:currentValue
    {readonly}
    {required}
    {invalid}
    options={options.current}
  />
{/key}
