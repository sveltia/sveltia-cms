<script>
  import { Option, Radio, RadioGroup, Select } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /** @type {LocaleCode} */ // svelte-ignore unused-export-let
  export let locale;
  /** @type {FieldKeyPath} */ // svelte-ignore unused-export-let
  export let keyPath;
  /** @type {string} */
  export let fieldId;
  /** @type {SelectField} */
  export let fieldConfig;
  /** @type {string} */
  export let currentValue;
  /** @type {boolean} */
  export let readonly = false;
  /** @type {boolean} */
  export let required = false;
  /** @type {boolean} */
  export let invalid = false;
  /** @type {{ label: string, value: string, searchValue?: string }[]} */
  export let options;

  $: ({ required = true, dropdown_threshold = 5 } = fieldConfig);

  $: {
    // Allow to deselect an option if the field is optional
    if (!required && !options.some(({ value }) => value === '')) {
      options.unshift({ label: $_('unselected_option'), value: '', searchValue: '' });
    }
  }
</script>

{#if options.length > dropdown_threshold}
  <Select
    bind:value={currentValue}
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
  >
    {#each options as { label, value, searchValue } (value)}
      <Option {label} {value} {searchValue} selected={value === currentValue} wrap />
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
      <Radio {label} {value} checked={value === currentValue} />
    {/each}
  </RadioGroup>
{/if}
