<script>
  import { Option, Radio, RadioGroup, Select } from '@sveltia/ui';

  /** @type {LocaleCode} */ // svelte-ignore unused-export-let
  export let locale;
  /** @type {string} */ // svelte-ignore unused-export-let
  export let keyPath;
  /** @type {string} */
  export let fieldId;
  /** @type {SelectField} */ // svelte-ignore unused-export-let
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
</script>

{#if options.length > 5}
  <Select
    bind:value={currentValue}
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
  >
    {#each options as { label, value, searchValue } (value)}
      <Option {label} {value} {searchValue} selected={value === currentValue} />
    {/each}
  </Select>
{:else}
  <RadioGroup
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
    on:change={({ detail: { value } }) => {
      currentValue = value;
    }}
  >
    {#each options as { label, value } (value)}
      <Radio {label} {value} checked={value === currentValue} />
    {/each}
  </RadioGroup>
{/if}
