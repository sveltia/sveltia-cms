<!--
  @component
  Implement the editor for the String widget.
  @see https://decapcms.org/docs/widgets/#string
-->
<script>
  import { TextInput } from '@sveltia/ui';

  /**
   * @type {LocaleCode}
   */
  // svelte-ignore unused-export-let
  export let locale;
  /**
   * @type {string}
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
   */
  const setInputValue = () => {
    if (currentValue === undefined) {
      return;
    }

    let newValue = currentValue;

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
   */
  const setCurrentValue = () => {
    let newValue = inputValue;

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

  $: {
    void currentValue;
    setInputValue();
  }

  $: {
    void inputValue;
    setCurrentValue();
  }
</script>

<TextInput
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
