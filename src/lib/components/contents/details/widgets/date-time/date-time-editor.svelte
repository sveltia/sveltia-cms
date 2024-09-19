<!--
  @component
  Implement the editor for the DataTime widget.
  @see https://decapcms.org/docs/widgets/#datetime
  @todo Replace the native `<input>` with a custom component.
-->
<script>
  import { Button } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import {
    getCurrentDateTime,
    getCurrentValue,
    getInputValue,
  } from '$lib/components/contents/details/widgets/date-time/helper';

  /**
   * @type {LocaleCode}
   */
  // svelte-ignore unused-export-let
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  // svelte-ignore unused-export-let
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
   * @type {DateTimeField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;
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
    date_format: dateFormat,
    time_format: timeFormat,
    picker_utc: utc = false,
  } = fieldConfig);
  $: dateOnly = timeFormat === false;
  $: timeOnly = dateFormat === false;

  /**
   * @type {string}
   */
  let inputValue;

  /**
   * Update {@link inputValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    const _inputValue = getInputValue(currentValue, fieldConfig);

    // Avoid a cycle dependency & infinite loop
    if (_inputValue !== undefined && _inputValue !== inputValue) {
      inputValue = _inputValue;
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue}.
   */
  const setCurrentValue = () => {
    const _currentValue = getCurrentValue(inputValue, fieldConfig);

    // Avoid a cycle dependency & infinite loop
    if (_currentValue !== undefined && _currentValue !== currentValue) {
      currentValue = _currentValue;
    }
  };

  $: {
    void currentValue;
    setInputValue();
  }

  $: {
    void inputValue;
    setCurrentValue();
  }
</script>

<div role="none">
  <input
    {...{
      // @see https://github.com/sveltejs/svelte/issues/3921
      // eslint-disable-next-line no-nested-ternary
      type: dateOnly ? 'date' : timeOnly ? 'time' : 'datetime-local',
    }}
    bind:value={inputValue}
    {readonly}
    aria-readonly={readonly}
    aria-required={required}
    aria-invalid={invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
  />
  {#if utc}
    <span role="none" class="utc">UTC</span>
  {/if}
  <Button
    variant="tertiary"
    label={$_(dateOnly ? 'today' : 'now')}
    onclick={() => {
      currentValue = getCurrentDateTime(fieldConfig);
    }}
  />
  <Button
    variant="tertiary"
    label={$_('clear')}
    disabled={!currentValue}
    onclick={() => {
      currentValue = '';
    }}
  />
</div>

<style lang="scss">
  div {
    display: flex;
    align-items: center;
  }

  .utc {
    margin: 0 8px;
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
