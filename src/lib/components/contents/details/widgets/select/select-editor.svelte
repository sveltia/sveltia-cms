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
   * @type {SelectField}
   */
  export let fieldConfig;
  /**
   * @type {any} // string | string[]
   */
  export let currentValue;
  /**
   * @type {boolean}
   */
  export let sortOptions = false;
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
    options: fieldOptions,
    multiple,
  } = fieldConfig);

  /**
   * @type {{ label: string, value: string, searchValue?: string }[]}
   */
  $: options = (() => {
    const _options =
      /** @type {{ label: string, value: string, searchValue?: string }[] | string[]} */ (
        fieldOptions
      ).map((option) =>
        isObject(option) ? /** @type {any} */ (option) : { label: option, value: option },
      );

    if (sortOptions) {
      _options.sort((a, b) => compare(a.label, b.label));
    }

    return _options;
  })();

  $: Select = multiple ? SelectMultiple : SelectSingle;
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
