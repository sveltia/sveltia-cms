<!--
  @component
  Implement the editor for the Color widget.
  @see https://decapcms.org/docs/widgets/#color
  @todo Replace the native `<input>` with a custom component.
-->
<script>
  import { Button, Slider, TextInput } from '@sveltia/ui';
  import { untrack } from 'svelte';
  import { _ } from 'svelte-i18n';

  /**
   * @import { WidgetEditorProps } from '$lib/types/private';
   * @import { ColorField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ColorField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldId,
    fieldConfig,
    currentValue = $bindable(''),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  let inputValue = $state('');
  let inputAlphaValue = $state(255);

  const { allowInput = false, enableAlpha = false } = $derived(fieldConfig);

  const id = $props.id();
  const rgbRegex = /^#[0-9a-f]{6}$/;
  const rgbaRegex = /^(?<rgb>#[0-9a-f]{6})(?<a>[0-9a-f]{2})?$/;

  /**
   * Update {@link inputValue} and {@link inputAlphaValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    if (typeof currentValue !== 'string') {
      return;
    }

    const { rgb: newValue, a: newAlphaHexValue = 'ff' } =
      currentValue.match(rgbaRegex)?.groups ?? {};

    // Avoid a cycle dependency & infinite loop
    if (newValue && inputValue !== newValue) {
      inputValue = newValue;
    }

    if (newValue && enableAlpha) {
      const newAlphaIntValue = Number.parseInt(`0x${newAlphaHexValue}`, 16);

      // Avoid a cycle dependency & infinite loop
      if (inputAlphaValue !== newAlphaIntValue) {
        inputAlphaValue = newAlphaIntValue;
      }
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue} and {@link inputAlphaValue}.
   */
  const setCurrentValue = () => {
    let newValue = rgbRegex.test(inputValue) ? inputValue : '';

    if (newValue && enableAlpha) {
      newValue += inputAlphaValue.toString(16).padStart(2, '0');
    }

    // Avoid a cycle dependency & infinite loop
    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  $effect(() => {
    void [currentValue];

    untrack(() => {
      setInputValue();
    });
  });

  $effect(() => {
    void [inputValue, inputAlphaValue];

    untrack(() => {
      setCurrentValue();
    });
  });
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
        {$_('opacity')}
        <Slider
          min={0}
          max={255}
          disabled={!inputValue}
          bind:value={inputAlphaValue}
          aria-label={$_('opacity')}
        />
      {/if}
    </span>
  {/if}
  {#if !readonly && !required}
    <Button
      variant="tertiary"
      label={$_('clear')}
      disabled={!inputValue}
      aria-controls={`${id}-picker ${allowInput ? `${id}-input` : ''}`}
      onclick={() => {
        inputValue = '';
        inputAlphaValue = 255;
      }}
    />
  {/if}
</div>

<style lang="scss">
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
          width: 80px;
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
