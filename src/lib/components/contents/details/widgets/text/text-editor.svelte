<!--
  @component
  Implement the editor for the Text widget.
  @see https://decapcms.org/docs/widgets/#text
-->
<script>
  import { TextArea } from '@sveltia/ui';
  import CharacterCounter from '$lib/components/contents/details/widgets/string/character-counter.svelte';

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
   * @type {TextField}
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
</script>

<TextArea
  bind:value={currentValue}
  flex
  {readonly}
  {required}
  {invalid}
  aria-labelledby="{fieldId}-label"
  aria-errormessage="{fieldId}-error"
  autoResize={true}
/>

<CharacterCounter {fieldConfig} {currentValue} />
