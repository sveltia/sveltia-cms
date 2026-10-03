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

  const {
    // Field type-specific options
    options: fieldOptions,
    multiple,
  } = $derived(fieldConfig);
  const Select = $derived(multiple ? SelectMultiple : SelectSingle);
  const options = $derived(
    fieldOptions.map(
      (option) =>
        /** @type {SelectFieldSelectorOption} */ (
          isObject(option) ? option : { label: option, value: option }
        ),
    ),
  );
</script>

{#key JSON.stringify(options)}
  <Select
    {locale}
    {keyPath}
    {fieldId}
    {fieldConfig}
    bind:currentValue
    {readonly}
    {required}
    {invalid}
    {options}
  />
{/key}
