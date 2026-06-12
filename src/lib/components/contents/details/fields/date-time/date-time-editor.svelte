<!--
  @component
  Implement the editor for a DateTime field.
  @see https://decapcms.org/docs/widgets/#Datetime
  @see https://sveltiacms.app/en/docs/fields/datetime
  @todo Replace the native `<input>` with a custom component.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/config';
  import {
    getCurrentDateTime,
    getCurrentValue,
    getDate,
    getInputValue,
  } from '$lib/services/contents/fields/date-time/helper';
  import {
    getInitialTimeZone,
    getTimeZoneLabel,
  } from '$lib/services/contents/fields/date-time/timezone';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { DateTimeField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {DateTimeField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  let inputValue = $state('');

  const { type, min, max, step, dateOnly, utc, singleCustomTimeZone } = $derived(
    parseDateTimeConfig(fieldConfig),
  );
  const timeZone = $derived(getInitialTimeZone(currentValue, fieldConfig));

  /**
   * Update {@link inputValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    const _inputValue = getInputValue({ currentValue, fieldConfig, timeZone });

    // Avoid a cycle dependency & infinite loop
    if (_inputValue !== undefined && _inputValue !== inputValue) {
      inputValue = _inputValue;
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue}.
   */
  const setCurrentValue = () => {
    const _currentValue = getCurrentValue({ inputValue, currentValue, fieldConfig, timeZone });

    // Avoid a cycle dependency & infinite loop
    if (
      _currentValue !== undefined &&
      _currentValue !== currentValue &&
      // Compare the actual date/time: if a user edits an existing entry in a different location
      // than where it was originally written, `inputValue` and `_currentValue` may shift to the
      // current timezone, but the epoch won’t change. Don’t update `currentValue` in that case.
      Number(getDate(_currentValue, fieldConfig)) !== Number(getDate(currentValue, fieldConfig))
    ) {
      currentValue = _currentValue;
    }
  };

  $effect(() => {
    // Keep the displayed value in sync with the stored entry value.
    void [currentValue];

    untrack(() => {
      setInputValue();
    });
  });

  $effect(() => {
    // Only update currentValue when inputValue changes (not when timezone changes)
    void [inputValue];

    untrack(() => {
      setCurrentValue();
    });
  });
</script>

<div role="none">
  <input
    {...{ type, min, max, step }}
    bind:value={inputValue}
    {readonly}
    aria-readonly={readonly}
    aria-required={required}
    aria-invalid={invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
  />
  {#if !readonly}
    <Button
      variant="tertiary"
      label={_(dateOnly ? 'today' : 'now')}
      onclick={() => {
        inputValue = getCurrentDateTime(fieldConfig, timeZone);
      }}
    />
  {/if}
  {#if !readonly && !required}
    <Button
      variant="tertiary"
      label={_('clear')}
      disabled={!currentValue}
      onclick={() => {
        currentValue = '';
      }}
    />
  {/if}
</div>

{#if singleCustomTimeZone}
  <div role="none" class="timezone">
    {getTimeZoneLabel(singleCustomTimeZone, getDate(currentValue, fieldConfig))}
  </div>
{:else if utc}
  <div role="none" class="timezone">UTC</div>
{/if}

<style>
  div {
    display: flex;
    align-items: center;
  }

  .timezone {
    margin: 4px 8px 0;
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
    white-space: nowrap;
  }
</style>
