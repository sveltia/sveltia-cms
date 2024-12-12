<!--
  @component
  Implement the editor for the Text widget.
  @see https://decapcms.org/docs/widgets/#text
-->
<script>
  import { TextArea } from '@sveltia/ui';
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
   * @type {TextField}
   */
  // svelte-ignore unused-export-let
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

  $: setInputValue(typeof currentValue === 'string' ? currentValue : '');
  $: setCurrentValue(inputValue ?? '');

  const { extraHint } = getContext('field-editor') ?? {};

  $: {
    if (extraHint) {
      $extraHint = CharacterCounter;
    }
  }
</script>

<TextArea
  lang={locale}
  bind:value={inputValue}
  flex
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
  autoResize={true}
/>
