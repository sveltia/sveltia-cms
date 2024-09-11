<!--
  @component
  Implement the editor for the Markdown widget.
  @see https://decapcms.org/docs/widgets/#markdown
-->
<script>
  import { TextEditor } from '@sveltia/ui';
  import {
    buttonNameMap,
    defaultButtons,
    defaultModes,
    modeNameMap,
  } from '$lib/components/contents/details/widgets/markdown';

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
   * @type {MarkdownField}
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
    modes = [...defaultModes],
    buttons = [...defaultButtons],
    minimal = false,
  } = fieldConfig);

  /**
   * @type {string}
   */
  let inputValue = '';

  /**
   * Update {@link inputValue} based on {@link currentValue} while avoiding a cycle dependency.
   * @param {string} newValue - New value to be set.
   */
  const setInputValue = (newValue) => {
    if (inputValue !== newValue) {
      inputValue = newValue;
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue} while avoiding a cycle dependency.
   * @param {string} newValue - New value to be set.
   */
  const setCurrentValue = (newValue) => {
    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  $: setInputValue(typeof currentValue === 'string' ? currentValue.trim() : '');
  $: setCurrentValue(inputValue?.trim() ?? '');
</script>

<div role="none" class="wrapper" class:minimal>
  <TextEditor
    modes={modes.map((name) => modeNameMap[name]).filter(Boolean)}
    buttons={buttons.map((name) => buttonNameMap[name]).filter(Boolean)}
    bind:value={inputValue}
    flex
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
    autoResize={true}
  />
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    &.minimal {
      :global([role='textbox']),
      :global(textarea) {
        overflow: auto;
        max-height: 240px;
      }
    }
  }
</style>
