<!--
  @component
  Implement the editor for the Select widget.
  @see https://decapcms.org/docs/widgets/#select
-->
<script>
  import { isObject } from '@sveltia/utils/object';
  import { compare } from '@sveltia/utils/string';
  import SelectMultiple from '$lib/components/contents/details/widgets/select/select-multiple.svelte';
  import SelectSingle from '$lib/components/contents/details/widgets/select/select-single.svelte';

  /**
   * @typedef {object} Props
   * @property {SelectField} fieldConfig - Field configuration.
   * @property {any} currentValue - Field value.
   * @property {boolean} [sortOptions] - Whether to sort the options by label.
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
    sortOptions = false,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    // Widget-specific options
    options: fieldOptions,
    multiple,
  } = $derived(fieldConfig);
  const Select = $derived(multiple ? SelectMultiple : SelectSingle);
  /** @type {SelectFieldSelectorOption[]} */
  const options = $derived.by(() => {
    const _options = fieldOptions.map((option) =>
      isObject(option) ? /** @type {any} */ (option) : { label: option, value: option },
    );

    if (sortOptions) {
      _options.sort((a, b) => compare(a.label, b.label));
    }

    return _options;
  });
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
