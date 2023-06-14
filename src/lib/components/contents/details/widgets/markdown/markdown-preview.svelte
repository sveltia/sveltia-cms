<!--
  @component
  Implement the preview for the Markdown widget.
  @see https://decapcms.org/docs/widgets/#markdown
-->
<script>
  import DOMPurify from 'isomorphic-dompurify';
  import { marked } from 'marked';

  // svelte-ignore unused-export-let
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  /**
   * @type {MarkdownField}
   */
  export let fieldConfig = undefined;
  /**
   * @type {string}
   */
  export let currentValue = undefined;

  $: ({
    // Widget-specific options
    sanitize_preview: sanitize = false,
  } = fieldConfig);

  $: rawHTML = marked.parse(currentValue || '');
</script>

<div role="document">
  {#if typeof currentValue === 'string' && currentValue.trim()}
    {@html sanitize ? DOMPurify.sanitize(rawHTML) : rawHTML}
  {/if}
</div>

<style lang="scss">
  [role='document'] {
    :global(:is(h1, h2, h3, h4, h5, h6, p, ul, ol)) {
      margin: 1em 0 0;
    }
  }
</style>
