<!--
  @component
  Implement the preview for the Markdown widget.
  @see https://decapcms.org/docs/widgets/#Markdown
-->
<script>
  import { sanitize } from 'isomorphic-dompurify';
  import { parse, use } from 'marked';
  import markedBidi from 'marked-bidi';

  import { getMediaFieldURL } from '$lib/services/assets/info';
  import { entryDraft } from '$lib/services/contents/draft';
  import { GLOBAL_IMAGE_REGEX } from '$lib/services/contents/widgets/markdown/constants';
  import { encodeImageSrc } from '$lib/services/contents/widgets/markdown/helper';

  /**
   * @import DOMPurify from 'isomorphic-dompurify';
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
  const { sanitize_preview: doSanitize = true } = $derived(fieldConfig);
  const markdown = $derived((currentValue ?? '').replace(GLOBAL_IMAGE_REGEX, encodeImageSrc));

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

  /** @type {DOMPurify.Config} */
  const sanitizeOptions = {
    // Allow `blob` images
    // @see https://github.com/cure53/DOMPurify/issues/549
    // @see https://github.com/cure53/DOMPurify#control-permitted-attribute-values
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  };

  use(markedBidi());

  $effect(() => {
    (async () => {
      rawHTML = await parse(markdown, markedOptions);
    })();
  });
</script>

<div role="none">
  {#if typeof currentValue === 'string' && currentValue.trim()}
    {@html doSanitize ? sanitize(rawHTML, sanitizeOptions) : rawHTML}
  {/if}
</div>

<style lang="scss">
  :global([role='document']) div {
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
