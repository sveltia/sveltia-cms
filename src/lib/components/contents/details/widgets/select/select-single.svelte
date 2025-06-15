<script>
  import { Option, Radio, RadioGroup, Select } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @import { SelectFieldSelectorProps } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} currentValue Field value.
   */

  /** @type {SelectFieldSelectorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    options,
    /* eslint-enable prefer-const */
  } = $props();

  const { dropdown_threshold: dropdownThreshold = 5 } = $derived(fieldConfig);
  /** @type {string | undefined} */
  let valueType = $state(undefined);

  $effect(() => {
    if (!valueType) {
      valueType = options[0]?.value !== undefined ? typeof options[0]?.value : 'string';
    }
  });

  $effect(() => {
    // Allow to deselect an option if the field is optional
    if (!required && !options.some(({ value }) => !value)) {
      options = [
        {
          label: $_('unselected_option'),
          value: valueType === 'number' ? null : '',
          searchValue: '',
        },
        ...options,
      ];
    }
  });
</script>

{#if options.length > dropdownThreshold}
  <Select
    bind:value={currentValue}
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
  >
    {#each options as { label, value, searchValue } (value)}
      <Option {label} {value} {valueType} {searchValue} selected={value === currentValue} wrap />
    {/each}
  </Select>
{:else}
  <RadioGroup
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
    onChange={({ detail: { value } }) => {
      currentValue = value;
    }}
  >
    {#each options as { label, value } (value)}
      <Radio {label} {value} {valueType} checked={value === currentValue} />
    {/each}
  </RadioGroup>
{/if}
