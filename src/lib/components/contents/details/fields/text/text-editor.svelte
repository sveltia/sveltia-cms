<!--
  @component
  Implement the editor for a Text field.
  @see https://decapcms.org/docs/widgets/#Text
  @see https://sveltiacms.app/en/docs/fields/text
-->
<script>
  import { TextArea } from '@sveltia/ui';
  import { getContext, untrack } from 'svelte';

  import CharacterCounter from '$lib/components/contents/details/fields/string/character-counter.svelte';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';

  /**
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import { TextField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {TextField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {FieldEditorContext} */
  const { extraHint } = getContext('field-editor') ?? {};

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

  /**
   * Update {@link inputValue} based on {@link currentValue} while avoiding a cycle dependency.
   */
  const setInputValue = () => {
    const newValue = typeof currentValue === 'string' ? currentValue : '';

    if (inputValue !== newValue) {
      inputValue = newValue;
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue} while avoiding a cycle dependency.
   */
  const setCurrentValue = () => {
    const newValue = inputValue;

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
