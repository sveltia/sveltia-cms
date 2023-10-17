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
   * @type {StringField}
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
  export let disabled = false;
</script>

<TextInput {disabled} bind:value={currentValue} />
