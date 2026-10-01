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

  import DateTimePreview from '$lib/components/contents/details/fields/date-time/date-time-preview.svelte';
  import { isAutoNowField } from '$lib/services/contents/fields/date-time/auto-now';
  import { parseDateTimeConfig } from '$lib/services/contents/fields/date-time/config';
  import { getDate } from '$lib/services/contents/fields/date-time/parse';
  import {
    getInitialTimeZone,
    getTimeZoneLabel,
  } from '$lib/services/contents/fields/date-time/timezone';
  import {
    getCurrentDateTime,
    getCurrentValue,
    getInputValue,
    shouldUpdateValue,
  } from '$lib/services/contents/fields/date-time/value';
  import { watch } from '$lib/services/utils/state.svelte';

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
    locale,
    keyPath,
    typedKeyPath,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  let inputValue = $state('');
  let isInputFocused = $state(false);

  const { type, min, max, step, dateOnly, utc, singleCustomTimeZone } = $derived(
    parseDateTimeConfig(fieldConfig),
  );
  const timeZone = $derived(getInitialTimeZone(currentValue, fieldConfig));

  /**
   * Update {@link inputValue} based on {@link currentValue}. Only update if the input is not
   * currently focused to avoid interfering with user typing.
   */
  const setInputValue = () => {
    if (isInputFocused) {
      return;
    }

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
    // A read-only field keeps its stored value as it is. The input drops the seconds with its
    // default `step`, so writing it back would truncate a value like one set by `auto_now`
    if (readonly) {
      return;
    }

    const newValue = getCurrentValue({ inputValue, currentValue, fieldConfig, timeZone });

    // Avoid a cycle dependency & infinite loop
    if (shouldUpdateValue({ newValue, currentValue, fieldConfig })) {
      currentValue = /** @type {string} */ (newValue);
    }
  };

  // Keep the displayed value in sync with the stored entry value.
  watch(
    () => currentValue,
    () => {
      setInputValue();
    },
  );

  // Only update currentValue when inputValue changes (not when timezone changes)
  watch(
    () => inputValue,
    () => {
      setCurrentValue();
    },
  );

  /**
   * Handle input focus event.
   */
  const handleFocus = () => {
    isInputFocused = true;
  };

  /**
   * Handle input blur event - sync values when user finishes editing.
   */
  const handleBlur = () => {
    isInputFocused = false;
    // After losing focus, ensure inputValue is synced with currentValue
    setInputValue();
  };
</script>

{#if readonly && isAutoNowField(fieldConfig)}
  <!-- The value is set on save, so it’s shown as text like in the preview rather than an input.
  The field is editable in a rich text editor component, where the option is ignored -->
  <DateTimePreview {locale} {keyPath} {typedKeyPath} {fieldConfig} {currentValue} />
{:else}
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
      onfocus={handleFocus}
      onblur={handleBlur}
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
