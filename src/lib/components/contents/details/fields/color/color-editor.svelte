<!--
  @component
  Implement the editor for a Color field.
  @see https://decapcms.org/docs/widgets/#color
  @see https://sveltiacms.app/en/docs/fields/color
  @todo Replace the native `<input>` with a custom component.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Slider, TextInput } from '@sveltia/ui';

  import {
    getColorFieldValue,
    parseColorFieldValue,
  } from '$lib/services/contents/fields/color/helpers';
  import { watch } from '$lib/services/utils/state.svelte';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { ColorField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ColorField} fieldConfig Field configuration.
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
  let inputAlphaValue = $state(255);

  const { allowInput = false, enableAlpha = false } = $derived(fieldConfig);

  const id = $props.id();

  /**
   * Update {@link inputValue} and {@link inputAlphaValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    const parts = parseColorFieldValue(currentValue);

    if (!parts) {
      return;
    }

    // Avoid a cycle dependency & infinite loop
    if (inputValue !== parts.rgb) {
      inputValue = parts.rgb;
    }

    if (enableAlpha && inputAlphaValue !== parts.alpha) {
      inputAlphaValue = parts.alpha;
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue} and {@link inputAlphaValue}.
   */
  const setCurrentValue = () => {
    const newValue = getColorFieldValue({ rgb: inputValue, alpha: inputAlphaValue, enableAlpha });

    // Avoid a cycle dependency & infinite loop
    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  watch(
    () => currentValue,
    () => {
      setInputValue();
    },
  );

  watch(
    () => [inputValue, inputAlphaValue],
    () => {
      setCurrentValue();
    },
  );
</script>

<div role="none">
  <input
    id="{id}-picker"
    type="color"
    bind:value={inputValue}
    {readonly}
    aria-invalid={invalid}
    aria-readonly={readonly}
    aria-required={required}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
  />
  {#if allowInput || enableAlpha}
    <span role="none" class="value">
      {#if allowInput}
        <TextInput
          dir="ltr"
          id="{id}-input"
          bind:value={inputValue}
          {invalid}
          {readonly}
          {required}
          aria-labelledby="{fieldId}-label"
          aria-errormessage="{fieldId}-error"
        />
      {/if}
      {#if enableAlpha}
        {_('opacity')}
        <Slider
          min={0}
          max={255}
          disabled={!inputValue}
          bind:value={inputAlphaValue}
          sliderLabel={_('opacity')}
        />
      {/if}
    </span>
  {/if}
  {#if !readonly && !required}
    <Button
      variant="tertiary"
      label={_('clear')}
      disabled={!inputValue}
      aria-controls={`${id}-picker ${allowInput ? `${id}-input` : ''}`}
      onclick={() => {
        inputValue = '';
        inputAlphaValue = 255;
      }}
    />
  {/if}
</div>

<style>
  div {
    display: flex;
    align-items: center;
    gap: 8px;

    .value {
      display: flex;
      align-items: center;
      gap: 8px;

      :global {
        .sui.text-input {
          width: 88px;
          min-width: 0;
        }

        .sui.slider {
          padding: 8px;
          --sui-slider-base-width: 80px;
        }
      }
    }
  }

  input {
    font-family: var(--sui-textbox-font-family);
  }
</style>
