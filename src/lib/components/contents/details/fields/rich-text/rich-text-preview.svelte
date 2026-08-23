<!--
  @component
  Implement the preview for a Markdown/RichText field.
  @see https://decapcms.org/docs/widgets/#Markdown
  @see https://sveltiacms.app/en/docs/fields/richtext
-->
<script>
  import { highlightCodeToHTML, loadCodeHighlighter } from '@sveltia/ui';
  import { parse, use } from 'marked';
  import markedBidi from 'marked-bidi';
  import { isValidElement } from 'react';
  import { createRoot } from 'react-dom/client';
  import { onMount } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';

  import { customComponentRegistry } from '$lib/services/api/registries';
  import { getMediaFieldURL } from '$lib/services/assets/info';
  import { cmsConfig } from '$lib/services/config';
  import { entryDraft } from '$lib/services/contents/draft';
  import { BUILTIN_COMPONENTS } from '$lib/services/contents/fields/rich-text';
  import { getComponentDef } from '$lib/services/contents/fields/rich-text/components/definitions';
  import {
    buildMarkdownWithPreviews,
    COMPONENT_QUERY_SELECTOR,
    IMAGE_QUERY_SELECTOR,
    sanitizeRichTextHTML,
    splitMarkdownBlocks,
  } from '$lib/services/contents/fields/rich-text/helpers';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { MarkdownField, RichTextField } from '$lib/types/public';
   * @import { ComponentPreview } from '$lib/services/contents/fields/rich-text/helpers';
   */

  /**
   * @typedef {object} Props
   * @property {MarkdownField | RichTextField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  use(markedBidi());

  use({
    renderer: {
      // Add syntax highlighting for code blocks using Shiki. This is done in the renderer to ensure
      // it runs before sanitization, allowing the highlighted HTML to be preserved in the preview.
      // Shiki loads its engine and grammars on demand, so this returns nothing until the language
      // is ready; `preloadHighlighter()` below fetches it and triggers a re-render.
      // eslint-disable-next-line jsdoc/require-jsdoc
      code({ text, lang }) {
        return (lang ? highlightCodeToHTML(text, lang) : undefined) ?? false;
      },
    },
  });

  const defaultConfig = $cmsConfig?.field_defaults?.richtext ?? {};
  /** @type {SvelteMap<HTMLElement, import('react-dom/client').Root>} */
  const reactRoots = new SvelteMap();
  /**
   * DOM element previews currently inserted in the preview pane. Used to notify each element with
   * an `Unmount` event once it’s removed, so the developer can destroy the component mounted on it.
   * @type {SvelteSet<Element>}
   */
  const previewNodes = new SvelteSet();

  /** @type {Map<string, ComponentPreview>} */
  let previewMap = new Map();

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
  /**
   * Bumped whenever a syntax highlighting grammar finishes loading. `parseMarkdown()` reads it so
   * the preview is rendered again with the code blocks highlighted.
   */
  let highlighterVersion = $state(0);
  /**
   * Sorted, comma-separated languages already handed to the highlighter, so a repeated edit doesn’t
   * request them again. Deliberately not reactive: it is written while rendering is in progress.
   */
  let requestedLanguages = '';

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

    // Pass the current map so unchanged components keep their existing preview instead of being
    // computed again, which would orphan an element preview along with any component mounted on it
    const { markdown: string, previewMap: newMap } = buildMarkdownWithPreviews(
      currentValue,
      componentDefs,
      previewMap,
    );

    previewMap = newMap;

    return string;
  });

  /**
   * Fetch the syntax highlighter for any language used in the given Markdown, then trigger a
   * re-render so the code blocks pick up the highlighting.
   *
   * Shiki fetches its engine and grammars on demand, while the Marked renderer is synchronous, so
   * the first render of a code block has no highlighting and this brings it up to date.
   * @param {string} value Markdown to scan for fenced code blocks.
   */
  const preloadHighlighter = async (value) => {
    const languages = [...value.matchAll(/^ {0,3}```(\S+)/gm)]
      .map(([, lang]) => lang)
      .filter((lang, index, list) => list.indexOf(lang) === index)
      .sort()
      .join(',');

    // Once requested, a set of languages is never requested again, whether or not each turned out
    // to be supported
    if (!languages || languages === requestedLanguages) {
      return;
    }

    requestedLanguages = languages;

    await Promise.all(languages.split(',').map((lang) => loadCodeHighlighter(lang)));

    highlighterVersion += 1;
  };

  /**
   * Render a component preview into the specified placeholder element based on its
   * `data-component-key` attribute.
   * @param {HTMLElement} element The placeholder element to render the component preview into.
   */
  const renderComponent = (element) => {
    const key = element.dataset.componentKey;
    const preview = key ? previewMap.get(key) : undefined;

    if (preview instanceof Element) {
      // Insert the DOM element as is, e.g. an element with a Svelte or Vue component mounted on it.
      // The element is not sanitized, just like a React element preview, so escaping any content
      // written by other users is up to the component developer
      element.replaceChildren(preview);
      previewNodes.add(preview);
    } else if (isValidElement(preview)) {
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
   * Dispatch an `Unmount` event on any DOM element preview that’s no longer connected to the
   * document, so the developer can destroy the component mounted on the element.
   * @param {boolean} [all] Whether to notify every element preview regardless of its connection
   * state. Used when the field preview itself is being destroyed.
   */
  const notifyRemovedPreviews = (all = false) => {
    previewNodes.forEach((node) => {
      if (all || !node.isConnected) {
        previewNodes.delete(node);
        node.dispatchEvent(new CustomEvent('Unmount'));
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
    /** @type {HTMLElement[]} */
    const removedElements = [];

    mutations.forEach(({ removedNodes, addedNodes }) => {
      removedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          removedElements.push(/** @type {HTMLElement} */ (node));
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

    // Handle removals after additions, so that an element preview moved to a new placeholder within
    // the same batch of mutations is not reported as unmounted
    removedElements.forEach((element) => {
      unmountRemovedRoots(element);
    });

    notifyRemovedPreviews();
  };

  /**
   * Parse a block of markdown into HTML, replacing component placeholders with their previews and
   * sanitizing the result if needed.
   * @param {string} block The markdown block to parse.
   * @returns {string} The parsed (and possibly sanitized) HTML string.
   */
  const parseMarkdown = (block) => {
    // Re-parse once a grammar has loaded, so the renderer can highlight what it previously couldn’t
    void highlighterVersion;

    const rawHTML = /** @type {string} */ (parse(block, { breaks: true }));

    return doSanitize ? sanitizeRichTextHTML(rawHTML) : rawHTML;
  };

  $effect(() => {
    if (markdown) {
      preloadHighlighter(markdown);
    }
  });

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
      notifyRemovedPreviews(true);
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

      pre.shiki {
        background-color: var(--sui-code-background-color) !important;
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
