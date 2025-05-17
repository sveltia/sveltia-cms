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
   * @import { WidgetPreviewProps } from '$lib/types/private';
   * @import { MarkdownField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MarkdownField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {WidgetPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  let rawHTML = $state('');

  const entry = $derived($entryDraft?.originalEntry);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const fileName = $derived($entryDraft?.fileName);
  const { sanitize_preview: sanitize = false } = $derived(fieldConfig);

  /** @type {import("marked").MarkedOptions} */
  const markedOptions = {
    breaks: true,
    async: true,
    // eslint-disable-next-line jsdoc/require-jsdoc
    walkTokens: async (token) => {
      if (token.type === 'image') {
        const url = await getMediaFieldURL({ value: token.href, entry, collectionName, fileName });

        if (url) {
          token.href = url;
        }
      }
    },
  };

  marked.use(markedBidi());

  $effect(() => {
    (async () => {
      rawHTML = await marked.parse(currentValue ?? '', markedOptions);
    })();
  });
</script>

<div role="none">
  {#if typeof currentValue === 'string' && currentValue.trim()}
    {@html sanitize ? DOMPurify.sanitize(rawHTML) : rawHTML}
  {/if}
</div>

<style lang="scss">
  div {
    :global {
      :is(h1, h2, h3, h4, h5, h6, p, ul, ol) {
        margin: 1em 0 0;
      }

      :is(video, img) {
        max-width: 100%;
        max-height: 100%;
      }

      :is(a:has(img)) {
        display: inline-block;

        img {
          pointer-events: none;
        }
      }
    }
  }
</style>
