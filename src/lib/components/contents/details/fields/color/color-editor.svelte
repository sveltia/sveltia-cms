<!--
  @component
  Implement the editor for a Color field.
  @see https://decapcms.org/docs/widgets/#color
  @see https://sveltiacms.app/en/docs/fields/color
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, ColorInput, Slider, TextInput } from '@sveltia/ui';

  import {
    getColorFieldInputValues,
    getColorFieldValue,
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
   * Values of the controls right after they were last synced with {@link currentValue}. The value
   * is only written back once the user has changed a control from these, so a stored color the
   * controls can’t represent, like `#fff` or `red`, isn’t replaced as soon as the editor is opened.
   */
  let syncedInputValues = { rgb: '', alpha: 255 };

  /**
   * Update {@link inputValue} and {@link inputAlphaValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    const parts = getColorFieldInputValues({
      currentValue,
      rgb: inputValue,
      alpha: inputAlphaValue,
      enableAlpha,
    });

    if (parts) {
      // Avoid a cycle dependency & infinite loop
      if (inputValue !== parts.rgb) {
        inputValue = parts.rgb;
      }

      if (enableAlpha && inputAlphaValue !== parts.alpha) {
        inputAlphaValue = parts.alpha;
      }
    }

    syncedInputValues = { rgb: inputValue, alpha: inputAlphaValue };
  };

  /**
   * Update {@link currentValue} based on {@link inputValue} and {@link inputAlphaValue}, if the
   * user has changed either of them.
   */
  const setCurrentValue = () => {
    if (inputValue === syncedInputValues.rgb && inputAlphaValue === syncedInputValues.alpha) {
      return;
    }

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
  <ColorInput
    id="{id}-picker"
    bind:value={inputValue}
    {readonly}
    {required}
    {invalid}
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
          {readonly}
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
</style>
