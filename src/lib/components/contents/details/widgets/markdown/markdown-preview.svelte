<!--
  @component
  Implement the preview for the Markdown widget.
  @see https://decapcms.org/docs/widgets/#markdown
-->
<script>
  import DOMPurify from 'isomorphic-dompurify';
  import { marked } from 'marked';
  import markedBidi from 'marked-bidi';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getMediaFieldURL } from '$lib/services/assets';

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
   * @type {MarkdownField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;

  $: ({
    // Widget-specific options
    sanitize_preview: sanitize = false,
  } = fieldConfig);

  marked.use(markedBidi());

  /** @type {import("marked").MarkedOptions} */
  const markedOptions = {
    breaks: true,
    async: true,
    // eslint-disable-next-line jsdoc/require-jsdoc
    walkTokens: async (token) => {
      if (token.type === 'image') {
        const url = await getMediaFieldURL(token.href, $entryDraft?.originalEntry);

        if (url) {
          token.href = url;
        }
      }
    },
  };

  let rawHTML = '';

  $: (async () => {
    rawHTML = await marked.parse(currentValue ?? '', markedOptions);
  })();
</script>

<div role="none">
  {#if typeof currentValue === 'string' && currentValue.trim()}
    {@html sanitize ? DOMPurify.sanitize(rawHTML) : rawHTML}
  {/if}
</div>

<style lang="scss">
  div {
    :global(:is(h1, h2, h3, h4, h5, h6, p, ul, ol)) {
      margin: 1em 0 0;
    }

    :global(:is(video, img)) {
      max-width: 100%;
      max-height: 100%;
    }
  }
</style>
