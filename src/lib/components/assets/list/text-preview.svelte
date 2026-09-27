<!--
  @component
  Preview of a plaintext asset in the details overlay. Markdown is rendered as HTML, anything else
  is shown as is.
-->
<script>
  import { parse } from 'marked';

  import { sanitizeRichTextHTML } from '$lib/services/contents/fields/rich-text/helpers';

  /**
   * @typedef {object} Props
   * @property {string} text File content.
   * @property {string} name File name, used to detect Markdown.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    text,
    name,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if name.endsWith('.md')}
  {#await parse(text, { breaks: true, async: true }) then rawHTML}
    <div role="figure" class="markdown">
      <!-- Unlike in the entry preview, a file from the repository can’t embed frames -->
      {@html sanitizeRichTextHTML(rawHTML, { ADD_TAGS: [] })}
    </div>
  {:catch}
    <pre role="figure">{text}</pre>
  {/await}
{:else}
  <pre role="figure">{text}</pre>
{/if}

<style>
  .markdown {
    /* Make the preview the containing block of any positioned element in the content, so an element
       with `position: fixed` from an inline style can’t cover the rest of the app */
    translate: 0;
  }

  pre,
  .markdown {
    display: block;
    margin: 0;
    padding: 16px;
    width: 100%;
    height: 100%;
    overflow: auto;
  }

  pre {
    white-space: pre-wrap;
  }
</style>
