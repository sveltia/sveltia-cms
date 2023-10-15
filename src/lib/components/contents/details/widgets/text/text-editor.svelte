<!--
  @component
  Implement the editor for the Text widget.
  @see https://decapcms.org/docs/widgets/#text
-->
<script>
  import { TextArea } from '@sveltia/ui';

  // svelte-ignore unused-export-let
  export let locale = '';

  // svelte-ignore unused-export-let
  export let keyPath = '';

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
  export let disabled = false;
</script>

<TextArea autoResize={true} {disabled} bind:value={currentValue} />
