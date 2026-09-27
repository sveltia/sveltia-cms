<!--
  @component
  Implement the editor for a String field.
  @see https://decapcms.org/docs/widgets/#String
  @see https://sveltiacms.app/en/docs/fields/string
-->
<script>
  import { TextInput } from '@sveltia/ui';

  import CharacterCounter from '$lib/components/contents/details/fields/string/character-counter.svelte';
  import { setExtraHint } from '$lib/services/contents/editor/extra-hint.svelte';
  import {
    getStringFieldValue,
    getStringInputValue,
  } from '$lib/services/contents/fields/string/helpers';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';
  import { syncValues } from '$lib/services/utils/state.svelte';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
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

  let inputValue = $state('');

  const {
    type = 'text',
    // svelte-ignore state_referenced_locally
    use_emoji_autocomplete: useEmojiAutocomplete = type === 'text',
  } = $derived(fieldConfig);

  // Sync `inputValue` with `currentValue` in both directions
  syncValues(
    () => currentValue,
    (value) => {
      currentValue = value;
    },
    () => inputValue,
    (input) => {
      inputValue = input;
    },
    (value) => getStringInputValue({ currentValue: value, fieldConfig }),
    (input) => getStringFieldValue({ inputValue: input, fieldConfig }),
  );

  setExtraHint(CharacterCounter);
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
