<!--
  @component
  Implement the editor for the String widget.
  @see https://decapcms.org/docs/widgets/#string
-->
<script>
  import { TextInput } from '@sveltia/ui';

  // svelte-ignore unused-export-let
  export let locale = '';

  // svelte-ignore unused-export-let
  export let keyPath = '';

  /**
   * @type {StringField}
   */
  // svelte-ignore unused-export-let
  export let fieldConfig = undefined;

  /**
   * @type {string}
   */
  export let currentValue = undefined;

  /**
   * @type {boolean}
   */
  export let disabled = false;
</script>

<TextInput {disabled} bind:value={currentValue} />
