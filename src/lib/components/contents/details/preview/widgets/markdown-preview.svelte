<!--
  @component
  Implement the preview for the Markdown widget.
  @see https://www.netlifycms.org/docs/widgets/#markdown
-->
<script>
  import { marked } from 'marked';

  // svelte-ignore unused-export-let
  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  // svelte-ignore unused-export-let
  export let fieldConfig = {};
  export let currentValue = undefined;
</script>

<div role="document">
  {#if typeof currentValue === 'string' && currentValue.trim()}
    {@html marked.parse(currentValue)}
  {/if}
</div>

<style lang="scss">
  [role='document'] {
    :global(:is(h1, h2, h3, h4, h5, h6, p, ul, ol)) {
      margin: 1em 0 0;
    }
  }
</style>
