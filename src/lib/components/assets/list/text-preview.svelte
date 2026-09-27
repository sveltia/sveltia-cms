<!--
  @component
  Preview of a plaintext asset in the details overlay. Markdown is rendered as HTML, anything else
  is shown as is.
-->
<script>
  import { sanitize } from 'isomorphic-dompurify';
  import { parse } from 'marked';

  /**
   * @typedef {object} Props
   * @property {string} text File content.
   * @property {string} name File name, used to detect Markdown.
   */

  /**
   * Options for {@link sanitize}. A `style` element would apply to the whole app, and a `form`
   * could send what the user types to another site.
   */
  const SANITIZE_OPTIONS = { FORBID_TAGS: ['style', 'form'] };

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
      {@html sanitize(rawHTML, SANITIZE_OPTIONS)}
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
