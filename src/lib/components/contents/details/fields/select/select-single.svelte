<script>
  import { _ } from '@sveltia/i18n';
  import { Option, Radio, RadioGroup, Select } from '@sveltia/ui';

  /**
   * @import { SelectFieldSelectorOption, SelectFieldSelectorProps } from '$lib/types/private';
   * @import { SelectFieldValue } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {SelectFieldValue | undefined} currentValue Field value.
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
  const valueType = $derived(options[0]?.value !== undefined ? typeof options[0].value : 'string');
  /**
   * Options to render, with an extra “unselected” option prepended so the user can clear the value
   * if the field is optional. This is derived rather than written back to the `options` prop from
   * an `$effect`. An effect that reads and writes the same state renders the field twice, and the
   * second pass tears down and rebuilds every option, because the `{#each}` key contains the
   * option index and prepending invalidates all of them. Worse, the write happens inside a running
   * reaction, where Svelte cannot memoize its dirty-marking traversal, so the cost grows with the
   * depth of the editor tree — a select nested in a list can lock up the browser for minutes.
   * @type {SelectFieldSelectorOption[]}
   */
  const allOptions = $derived(
    !required && !options.some(({ value }) => !value)
      ? [
          {
            label: _('unselected_option'),
            value: valueType === 'number' ? null : '',
            searchValue: '',
          },
          ...options,
        ]
      : options,
  );
</script>

{#if allOptions.length > dropdownThreshold}
  <Select
    bind:value={currentValue}
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
  >
    {#each allOptions as { label, value, searchValue }, index (`${index}-${value}`)}
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
    {#each allOptions as { label, value }, index (`${index}-${value}`)}
      <Radio {label} {value} {valueType} checked={value === currentValue} />
    {/each}
  </RadioGroup>
{/if}
