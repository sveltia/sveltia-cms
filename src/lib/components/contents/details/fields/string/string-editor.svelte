<!--
  @component
  Implement the editor for a String field.
  @see https://decapcms.org/docs/widgets/#String
  @see https://sveltiacms.app/en/docs/fields/string
-->
<script>
  import { TextInput } from '@sveltia/ui';
  import { getContext } from 'svelte';

  import CharacterCounter from '$lib/components/contents/details/fields/string/character-counter.svelte';
  import {
    getStringFieldValue,
    getStringInputValue,
  } from '$lib/services/contents/fields/string/helpers';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';
  import { watch } from '$lib/services/utils/state.svelte';

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

  const {
    type = 'text',
    // svelte-ignore state_referenced_locally
    use_emoji_autocomplete: useEmojiAutocomplete = type === 'text',
  } = $derived(fieldConfig);

  /**
   * Update {@link inputValue} based on {@link currentValue}.
   */
  const setInputValue = () => {
    const newValue = getStringInputValue({ currentValue, fieldConfig });

    // Avoid a cycle dependency & infinite loop
    if (inputValue !== newValue) {
      inputValue = newValue;
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue}.
   */
  const setCurrentValue = () => {
    const newValue = getStringFieldValue({ inputValue, fieldConfig });

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
    () => inputValue,
    () => {
      setCurrentValue();
    },
  );

  $effect(() => {
    if (extraHint) {
      extraHint.current = CharacterCounter;
    }
  });
</script>

<TextInput
  lang={getCanonicalLocale(locale)}
  dir={getDirection(locale)}
  bind:value={inputValue}
  {type}
  inputmode={type}
  flex
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
  {useEmojiAutocomplete}
/>
