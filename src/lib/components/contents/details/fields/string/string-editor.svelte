<!--
  @component
  Implement the editor for a String field.
  @see https://decapcms.org/docs/widgets/#String
-->
<script>
  import { TextInput } from '@sveltia/ui';
  import { getContext, untrack } from 'svelte';

  import CharacterCounter from '$lib/components/contents/details/fields/string/character-counter.svelte';
  import { getCanonicalLocale } from '$lib/services/contents/i18n';

  /**
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import { StringField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {StringField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {FieldEditorContext} */
  const { extraHint } = getContext('field-editor') ?? {};

  let inputValue = $state('');

  const { type = 'text', prefix = '', suffix = '' } = $derived(fieldConfig);

  /**
   * Update {@link inputValue} based on {@link currentValue}. Remove the suffix/prefix if needed.
   */
  const setInputValue = () => {
    let newValue = typeof currentValue === 'string' ? currentValue : '';

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

    // Add affixes only if value is not empty
    if (newValue.trim() && (prefix || suffix)) {
      newValue = `${prefix}${newValue}${suffix}`;
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
    void [inputValue];

    untrack(() => {
      setCurrentValue();
    });
  });

  $effect(() => {
    if (extraHint) {
      $extraHint = CharacterCounter;
    }
  });
</script>

<TextInput
  lang={getCanonicalLocale(locale)}
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
