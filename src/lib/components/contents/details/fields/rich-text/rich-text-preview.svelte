<!--
  @component
  Implement the preview for a Markdown/RichText field.
  @see https://decapcms.org/docs/widgets/#Markdown
  @see https://sveltiacms.app/en/docs/fields/richtext
-->
<script>
  import { parse, use } from 'marked';
  import markedBidi from 'marked-bidi';
  import { isValidElement } from 'react';
  import { createRoot } from 'react-dom/client';
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  import { getMediaFieldURL } from '$lib/services/assets/info';
  import { cmsConfig } from '$lib/services/config';
  import { customComponentRegistry } from '$lib/services/contents/api/registries';
  import { entryDraft } from '$lib/services/contents/draft';
  import { BUILTIN_COMPONENTS } from '$lib/services/contents/fields/rich-text';
  import { getComponentDef } from '$lib/services/contents/fields/rich-text/components/definitions';
  import {
    buildMarkdownWithPreviews,
    COMPONENT_QUERY_SELECTOR,
    IMAGE_QUERY_SELECTOR,
    sanitizeRichTextHTML,
    splitMarkdownBlocks,
  } from '$lib/services/contents/fields/rich-text/helper';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { MarkdownField, RichTextField } from '$lib/types/public';
   * @import { ComponentPreview } from '$lib/services/contents/fields/rich-text/helper';
   */

  /**
   * @typedef {object} Props
   * @property {MarkdownField | RichTextField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  use(markedBidi());

  use({
    renderer: {
      // Add syntax highlighting for code blocks using Prism.js if available. This is done in the
      // renderer to ensure it runs before sanitization, allowing the highlighted HTML to be
      // preserved in the preview.
      // eslint-disable-next-line jsdoc/require-jsdoc
      code({ text, lang }) {
        const { Prism } = /** @type {any} */ (window);

        if (Prism && lang && Prism.languages[lang]) {
          const highlighted = Prism.highlight(text, Prism.languages[lang], lang);

          return `<pre><code class="language-${lang}">${highlighted}</code></pre>\n`;
        }

        return false;
      },
    },
  });

  const defaultConfig = $cmsConfig?.field_defaults?.richtext ?? {};
  /** @type {SvelteMap<HTMLElement, import('react-dom/client').Root>} */
  const reactRoots = new SvelteMap();

  /** @type {SvelteMap<string, ComponentPreview>} */
  let previewMap = new SvelteMap();

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    typedKeyPath,
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLElement | undefined} */
  let container = $state();
  let observerReady = $state(false);

  const entry = $derived($entryDraft?.originalEntry);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const fileName = $derived($entryDraft?.fileName);
  const {
    sanitize_preview: doSanitize = defaultConfig.sanitize_preview ?? true,
    editor_components: _editorComponents = defaultConfig.editor_components ??
      // Include all built-in and custom components by default
      [...BUILTIN_COMPONENTS, ...customComponentRegistry.keys()],
    linked_images: linkedImagesEnabled = defaultConfig.linked_images ?? true,
  } = $derived(fieldConfig);
  const componentDefs = $derived(
    _editorComponents
      .map((name) =>
        getComponentDef(name === 'image' && linkedImagesEnabled ? 'linked-image' : name),
      )
      .filter((def) => !!def),
  );

  const markdown = $derived.by(() => {
    if (typeof currentValue !== 'string' || !currentValue.trim()) {
      return '';
    }

    const { markdown: string, previewMap: newMap } = buildMarkdownWithPreviews(
      currentValue,
      componentDefs,
    );

    previewMap = /** @type {SvelteMap<string, ComponentPreview>} */ (newMap);

    return string;
  });

  /**
   * Render a React component preview into the specified element based on its `data-component-key`
   * attribute.
   * @param {HTMLElement} element The element to render the component preview into.
   */
  const renderComponent = (element) => {
    const key = element.dataset.componentKey;
    const preview = key ? previewMap.get(key) : undefined;

    if (isValidElement(preview)) {
      // Mount the React component
      const root = createRoot(element);

      reactRoots.set(element, root);
      root.render(preview);
    } else {
      // Remove the placeholder if there’s no valid preview to render
      element.remove();
    }
  };

  /**
   * Unmount any React component previews that are removed from the DOM.
   * @param {HTMLElement} element The removed element to check for mounted React components.
   */
  const unmountRemovedRoots = (element) => {
    [element, ...element.querySelectorAll(COMPONENT_QUERY_SELECTOR)].forEach((el) => {
      const root = reactRoots.get(/** @type {HTMLElement} */ (el));

      if (root) {
        root.unmount();
        reactRoots.delete(/** @type {HTMLElement} */ (el));
      }
    });
  };

  /**
   * Replace the `src` of an image element with the URL from the media field. This is needed to
   * properly display media fields in the preview, as the markdown may contain internal paths that
   * have to be resolved to blob URLs.
   * @param {HTMLImageElement} element The image element to replace the `src` of.
   */
  const replaceImageSrc = async (element) => {
    element.dataset.processed = 'true';

    const value = /** @type {string} */ (element.getAttribute('src'));
    const url = await getMediaFieldURL({ value, entry, collectionName, fileName, typedKeyPath });

    if (url) {
      element.src = url;
    }
  };

  /**
   * Callback for the `MutationObserver` to detect added and removed nodes in the container. It
   * renders component previews for added nodes and unmounts React roots for removed nodes. Also
   * handles replacing image `src` attributes for media fields.
   * @param {MutationRecord[]} mutations The list of mutations observed.
   */
  const mutationCallback = (mutations) => {
    mutations.forEach(({ removedNodes, addedNodes }) => {
      removedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          unmountRemovedRoots(/** @type {HTMLElement} */ (node));
        }
      });

      addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const element = /** @type {HTMLElement} */ (node);

        if (element.matches(COMPONENT_QUERY_SELECTOR)) {
          renderComponent(element);
        } else {
          element.querySelectorAll(COMPONENT_QUERY_SELECTOR).forEach((el) => {
            renderComponent(/** @type {HTMLElement} */ (el));
          });
        }

        if (element.matches(IMAGE_QUERY_SELECTOR)) {
          replaceImageSrc(/** @type {HTMLImageElement} */ (element));
        } else {
          element.querySelectorAll(IMAGE_QUERY_SELECTOR).forEach((img) => {
            replaceImageSrc(/** @type {HTMLImageElement} */ (img));
          });
        }
      });
    });
  };

  /**
   * Parse a block of markdown into HTML, replacing component placeholders with their previews and
   * sanitizing the result if needed.
   * @param {string} block The markdown block to parse.
   * @returns {string} The parsed (and possibly sanitized) HTML string.
   */
  const parseMarkdown = (block) => {
    const rawHTML = /** @type {string} */ (parse(block, { breaks: true }));

    return doSanitize ? sanitizeRichTextHTML(rawHTML) : rawHTML;
  };

  onMount(() => {
    const observer = new MutationObserver(mutationCallback);

    // Make sure to render the markdown after the observer is set up, otherwise the callback may not
    // be called for the initial content.
    // @see https://github.com/sveltia/sveltia-cms/issues/805
    observer.observe(/** @type {HTMLElement} */ (container), { childList: true, subtree: true });
    observerReady = true;

    return () => {
      observer.disconnect();
      reactRoots.forEach((root) => root.unmount());
      reactRoots.clear();
    };
  });
</script>

<div role="none" bind:this={container}>
  {#if observerReady && markdown}
    {#each splitMarkdownBlocks(markdown) as block, index (`${index}-${block}`)}
      {@html parseMarkdown(block)}
    {/each}
  {/if}
</div>

<style>
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

  div {
    :global {
      [data-component-key] {
        display: contents;
      }
    }
  }
</style>
