<!--
  @component
  Implement the editor for the String widget.
  @see https://decapcms.org/docs/widgets/#string
-->
<script>
  import { TextInput } from '@sveltia/ui';
  import { getContext } from 'svelte';
  import CharacterCounter from '$lib/components/contents/details/widgets/string/character-counter.svelte';

  /**
   * @type {LocaleCode}
   */
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
   * @type {StringField}
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
    type = 'text',
    prefix = '',
    suffix = '',
  } = fieldConfig);

  /**
   * @type {string}
   */
  let inputValue = '';

  /**
   * Update {@link inputValue} based on {@link currentValue}. Remove the suffix/prefix if needed.
   * @param {string} newValue - New value to be set.
   */
  const setInputValue = (newValue) => {
    if (prefix && newValue.startsWith(prefix)) {
      newValue = newValue.slice(prefix.length);
    }

    if (suffix && newValue.endsWith(suffix)) {
      newValue = newValue.slice(0, -suffix.length);
    }

    // Avoid a cycle dependency & infinite loop
    if (inputValue !== newValue) {
      inputValue = newValue;
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue}. Add the suffix/prefix if needed.
   * @param {string} newValue - New value to be set.
   */
  const setCurrentValue = (newValue) => {
    if (prefix && !newValue.startsWith(prefix)) {
      newValue = `${prefix}${newValue}`;
    }

    if (suffix && !newValue.endsWith(suffix)) {
      newValue = `${newValue}${suffix}`;
    }

    // Avoid a cycle dependency & infinite loop
    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  $: setInputValue(typeof currentValue === 'string' ? currentValue : '');
  $: setCurrentValue(inputValue ?? '');

  const { extraHint } = getContext('field-editor') ?? {};

  $: {
    if (extraHint) {
      $extraHint = CharacterCounter;
    }
  }
</script>

<TextInput
  lang={locale}
  bind:value={inputValue}
  {type}
  inputmode={type}
  flex
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
/>
