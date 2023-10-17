<!--
  @component
  Implement the editor for the Markdown widget.
  @see https://decapcms.org/docs/widgets/#markdown
  @todo Implement the editor!
-->
<script>
  import { TextArea } from '@sveltia/ui';

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
   * @type {MarkdownField}
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
