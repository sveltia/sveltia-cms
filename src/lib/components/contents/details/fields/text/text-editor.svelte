<!--
  @component
  Implement the editor for a Text field.
  @see https://decapcms.org/docs/widgets/#Text
  @see https://sveltiacms.app/en/docs/fields/text
-->
<script>
  import { TextArea } from '@sveltia/ui';

  import CharacterCounter from '$lib/components/contents/details/fields/string/character-counter.svelte';
  import { setExtraHint } from '$lib/services/contents/editor/extra-hint.svelte';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';
  import { syncValues } from '$lib/services/utils/state.svelte';

  /**
   * @import { FieldEditorProps } from '$lib/types/private';
   * @import { TextField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {TextField} fieldConfig Field configuration.
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

  const { use_emoji_autocomplete: useEmojiAutocomplete = true } = $derived(fieldConfig);

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
    (value) => (typeof value === 'string' ? value : ''),
  );

  setExtraHint(CharacterCounter);
</script>

<TextArea
  lang={getCanonicalLocale(locale)}
  dir={getDirection(locale)}
  bind:value={inputValue}
  flex
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
  autoResize={true}
  {useEmojiAutocomplete}
/>
