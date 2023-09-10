<!--
  @component
  Implement the editor for the Markdown widget.
  @see https://decapcms.org/docs/widgets/#markdown
  @todo Implement the editor!
-->
<script>
  import { TextArea } from '@sveltia/ui';

  // svelte-ignore unused-export-let
  export let locale = '';

  // svelte-ignore unused-export-let
  export let keyPath = '';

  /**
   * @type {MarkdownField}
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

<TextArea autoResize={true} {disabled} bind:value={currentValue} />
