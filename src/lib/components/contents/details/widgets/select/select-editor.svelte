<!--
  @component
  Implement the editor for the Select widget.
  @see https://decapcms.org/docs/widgets/#select
-->
<script>
  import { isObject } from '@sveltia/utils/object';
  import SelectMultiple from '$lib/components/contents/details/widgets/select/select-multiple.svelte';
  import SelectSingle from '$lib/components/contents/details/widgets/select/select-single.svelte';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {string}
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
      _options.sort((a, b) => a.label.localeCompare(b.label));
    }

    return _options;
  })();
</script>

<svelte:component
  this={multiple ? SelectMultiple : SelectSingle}
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
