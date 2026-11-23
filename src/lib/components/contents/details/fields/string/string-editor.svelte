<!--
  @component
  Implement the editor for a String field, and, with `multiline`, for a Text field.
  @see https://decapcms.org/docs/widgets/#String
  @see https://sveltiacms.app/en/docs/fields/string
-->
<script>
  import { TextArea, TextInput } from '@sveltia/ui';

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
   * @import { StringField, TextField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {StringField | TextField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   * @property {boolean} [multiline] Whether to edit a Text field in an auto-resizing text area,
   * which takes the value as is, without the String field’s `type`, `prefix` and `suffix`.
   */

  /** @type {FieldEditorProps & Props} */
  let {
    locale,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    multiline = false,
  } = $props();

  let inputValue = $state('');

  /** The configuration, with the String field options, which a Text field lacks. */
  const stringFieldConfig = $derived(/** @type {StringField} */ (fieldConfig));
  const {
    type = 'text',
    // svelte-ignore state_referenced_locally
    use_emoji_autocomplete: useEmojiAutocomplete = multiline || type === 'text',
  } = $derived(stringFieldConfig);

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
    (value) => {
      if (multiline) {
        return typeof value === 'string' ? value : '';
      }

      return getStringInputValue({ currentValue: value, fieldConfig: stringFieldConfig });
    },
    (input) =>
      multiline
        ? input
        : getStringFieldValue({ inputValue: input, fieldConfig: stringFieldConfig }),
  );

  setExtraHint(CharacterCounter);
</script>

<!-- The props are written out rather than spread from one object: a spread object recreated when
  `invalid` changes makes the input report an `undefined` value back through the binding -->
{#if multiline}
  <TextArea
    lang={getCanonicalLocale(locale)}
    dir={getDirection(locale)}
    flex
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
    {useEmojiAutocomplete}
    bind:value={inputValue}
    autoResize={true}
  />
{:else}
  <TextInput
    lang={getCanonicalLocale(locale)}
    dir={getDirection(locale)}
    flex
    {readonly}
    {required}
    {invalid}
    aria-labelledby="{fieldId}-label"
    aria-errormessage="{fieldId}-error"
    {useEmojiAutocomplete}
    bind:value={inputValue}
    {type}
    inputmode={type}
  />
{/if}
