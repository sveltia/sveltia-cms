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
  import { onMount, tick } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';

  import { waitForAssetURL } from '$lib/services/api/asset-proxy';
  import { createGetAsset } from '$lib/services/api/preview-data';
  import { getReactDom, loadReactDom, reactDomLoaded } from '$lib/services/api/react-dom';
  import { customComponentRegistry } from '$lib/services/api/registries';
  import { getRichTextMediaURL } from '$lib/services/assets/media-field';
  import { cmsConfig } from '$lib/services/config';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { BUILTIN_COMPONENTS, getValueFormat } from '$lib/services/contents/fields/rich-text';
  import { getComponentDef } from '$lib/services/contents/fields/rich-text/components/definitions';
  import {
    buildMarkdownWithPreviews,
    COMPONENT_QUERY_SELECTOR,
    CONTAINER_QUERY_SELECTOR,
    MEDIA_QUERY_SELECTOR,
    resolveMediaURLs,
    splitHTMLBlocks,
    splitMarkdownBlocks,
  } from '$lib/services/contents/fields/rich-text/previews';
  import { sanitizeRichTextHTML } from '$lib/services/contents/fields/rich-text/sanitize';

  /**
   * @import { ReactElement } from 'react';
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { ApiAsset, MarkdownField, RichTextField } from '$lib/types/public';
   * @import { ComponentPreview } from '$lib/services/contents/fields/rich-text/previews';
   */

  /**
   * @typedef {object} Props
   * @property {MarkdownField | RichTextField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

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

  const defaultConfig = cmsConfig.current?.field_defaults?.richtext ?? {};
  /** @type {SvelteMap<HTMLElement, import('react-dom/client').Root>} */
  const reactRoots = new SvelteMap();
  /**
   * DOM element previews currently inserted in the preview pane. Used to notify each element with
   * an `Unmount` event once it’s removed, so the developer can destroy the component mounted on it.
   * @type {SvelteSet<Element>}
   */
  const previewNodes = new SvelteSet();

  /**
   * Component previews by key. Deliberately not reactive: it is written while `markdown` is
   * computed.
   * @type {Map<string, ComponentPreview>}
   */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  let previewMap = new Map();
  /**
   * Assets the component previews computed in the latest run have got with `getAsset()`, keyed by
   * the preview key. Deliberately not reactive, like `previewMap`.
   * @type {Map<string, ApiAsset[]>}
   */
  let newPreviewAssets = new Map();

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
   * Bumped whenever a component preview has been dropped because an asset it got with `getAsset()`
   * has a new URL. `markdown` reads it so the preview is computed again with the new URL.
   */
  let assetURLVersion = $state(0);
  /**
   * Sorted, comma-separated languages already handed to the highlighter, so a repeated edit doesn’t
   * request them again. Deliberately not reactive: it is written while rendering is in progress.
   */
  let requestedLanguages = '';

  const entry = $derived(entryDraft.current?.originalEntry);
  /* v8 ignore start -- the preview is only rendered while the draft is there */
  const collectionName = $derived(entryDraft.current?.collectionName ?? '');
  /* v8 ignore stop */
  const fileName = $derived(entryDraft.current?.fileName);
  const {
    sanitize_preview: doSanitize = defaultConfig.sanitize_preview ?? true,
    editor_components: _editorComponents = defaultConfig.editor_components ??
      // Include all built-in and custom components by default
      [...BUILTIN_COMPONENTS, ...customComponentRegistry.keys()],
    linked_images: linkedImagesEnabled = defaultConfig.linked_images ?? true,
  } = $derived(fieldConfig);
  const format = $derived(getValueFormat(fieldConfig));
  const isHTML = $derived(format === 'html');
  const componentDefs = $derived(
    _editorComponents
      .map((name) =>
        getComponentDef(name === 'image' && linkedImagesEnabled ? 'linked-image' : name),
      )
      .filter((def) => !!def),
  );
  const componentNames = $derived(componentDefs.map(({ id }) => id));
  /**
   * Asset getter passed to each editor component’s `toPreview()`, which resolves a file path the
   * same way as an image in the preview, including a file that hasn’t been saved yet.
   */
  const getAsset = $derived(
    createGetAsset({
      entry,
      collectionName,
      fileName,
      files: entryDraft.current?.files,
      typedKeyPath,
      componentNames,
    }),
  );

  const markdown = $derived.by(() => {
    if (typeof currentValue !== 'string' || !currentValue.trim()) {
      return '';
    }

    // Compute again a preview dropped because an asset URL has changed
    void assetURLVersion;

    // Pass the current map so unchanged components keep their existing preview instead of being
    // computed again, which would orphan an element preview along with any component mounted on it
    const {
      markdown: string,
      previewMap: newMap,
      assetMap,
    } = buildMarkdownWithPreviews(currentValue, componentDefs, previewMap, getAsset, format);

    previewMap = newMap;
    newPreviewAssets = assetMap;

    return string;
  });

  /**
   * The Markdown or HTML split into blocks, each with a key that identifies it by content rather
   * than by position: editing near the top of a long document then only re-renders the block that
   * changed, instead of every block after it. Identical blocks are told apart by their occurrence.
   * @type {{ key: string, block: string }[]}
   */
  const keyedBlocks = $derived.by(() => {
    // A scratch counter for this computation, not state
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const occurrences = /** @type {Map<string, number>} */ (new Map());

    return (isHTML ? splitHTMLBlocks : splitMarkdownBlocks)(markdown).map((block) => {
      const occurrence = occurrences.get(block) ?? 0;

      occurrences.set(block, occurrence + 1);

      return { key: `${occurrence}\n${block}`, block };
    });
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
   * Check if the given element belongs to this preview rather than a nested preview rendered with
   * `CMS.renderRichText()` inside an element preview. Since the `MutationObserver` watches the
   * whole subtree, a placeholder or image added by a nested preview is also reported here, but it
   * has to be handled by the nested preview, which owns the corresponding preview map.
   * @param {Element} element Element to check.
   * @returns {boolean} `true` if the element is owned by this preview.
   */
  const isOwnElement = (element) => element.closest(CONTAINER_QUERY_SELECTOR) === container;

  /**
   * Mount a React element preview on the given placeholder element.
   * @param {HTMLElement} element Placeholder element.
   * @param {ReactElement} preview React element to be rendered.
   */
  const mountReactPreview = (element, preview) => {
    const root = getReactDom().createRoot(element);

    reactRoots.set(element, root);
    root.render(preview);
  };

  /* v8 ignore start -- the library is bundled with the tests, so loading can’t fail */
  /**
   * Report a failure to load the React DOM library.
   * @param {Error} error Error.
   */
  const reportLoadError = (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
  };
  /* v8 ignore stop */

  /**
   * Render a component preview into the specified placeholder element based on its
   * `data-component-key` attribute.
   * @param {HTMLElement} element The placeholder element to render the component preview into.
   */
  const renderComponent = (element) => {
    // A placeholder within a nested field preview belongs to that preview
    /* v8 ignore next 3 */
    if (!isOwnElement(element)) {
      return;
    }

    const key = element.dataset.componentKey;
    const preview = key ? previewMap.get(key) : undefined;

    if (preview instanceof Element) {
      // Insert the DOM element as is, e.g. an element with a Svelte or Vue component mounted on it.
      // The element is not sanitized, just like a React element preview, so escaping any content
      // written by other users is up to the component developer
      element.replaceChildren(preview);
      previewNodes.add(preview);
    } else if (isValidElement(preview)) {
      // Mount the React component. `react-dom` is only loaded once a preview actually needs it, as
      // nothing else in the rich text editor does
      if (reactDomLoaded.current) {
        mountReactPreview(element, preview);
      } else {
        loadReactDom()
          .then(() => {
            // The placeholder may be gone, or mounted by a later mutation, by the time it’s loaded
            if (element.isConnected && !reactRoots.has(element)) {
              mountReactPreview(element, preview);
            }
          })
          .catch(reportLoadError);
      }
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
   * Dispatch an `Unmount` event on any DOM element preview that’s no longer in the container, so
   * the developer can destroy the component mounted on the element. The container itself may be
   * detached from the document when this is a nested preview rendered with `CMS.renderRichText()`
   * inside an element preview that’s not yet inserted, so `isConnected` cannot be used here.
   * @param {boolean} [all] Whether to notify every element preview regardless of its state. Used
   * when the field preview itself is being destroyed.
   */
  const notifyRemovedPreviews = (all = false) => {
    previewNodes.forEach((node) => {
      if (all || !container?.contains(node)) {
        previewNodes.delete(node);
        node.dispatchEvent(new CustomEvent('Unmount'));
      }
    });
  };

  /**
   * Compute a component preview again once an asset it got with `getAsset()` has a new URL: the
   * blob URL of a file that had to be retrieved first. The file may not have been published, in
   * which case the public path the asset initially had doesn’t point to it. A string preview is
   * then rendered again with the rest of the Markdown, while an element or React element preview
   * replaces the current one in its placeholder, which stays as is.
   * @param {Map<string, ApiAsset[]>} assetMap Assets the newly computed previews have got, keyed by
   * the preview key.
   */
  const refreshOnAssetURLChange = (assetMap) => {
    assetMap.forEach((assets, key) => {
      const preview = previewMap.get(key);

      Promise.all(assets.map(waitForAssetURL)).then(async (results) => {
        // The preview may have been replaced meanwhile, e.g. because the component was edited
        if (!results.includes(true) || previewMap.get(key) !== preview) {
          return;
        }

        previewMap.delete(key);
        assetURLVersion += 1;
        await tick();

        container?.querySelectorAll(`[data-component-key="${key}"]`).forEach((element) => {
          const root = reactRoots.get(/** @type {HTMLElement} */ (element));

          root?.unmount();
          reactRoots.delete(/** @type {HTMLElement} */ (element));
          renderComponent(/** @type {HTMLElement} */ (element));
        });

        notifyRemovedPreviews();
      });
    });
  };

  /**
   * Resolve the file paths in the URL attributes of a media element, e.g. an image `src`. This is
   * needed to properly display media fields in the preview, as the markdown may contain internal
   * paths that have to be resolved to blob URLs.
   * @param {Element} element Image, video, audio or source element.
   */
  const replaceMediaURLs = async (element) => {
    // An element within a nested field preview belongs to that preview
    /* v8 ignore next 3 */
    if (!isOwnElement(element)) {
      return;
    }

    /** @type {HTMLElement} */ (element).dataset.processed = 'true';

    await resolveMediaURLs(element, (value) =>
      getRichTextMediaURL({
        value,
        entry,
        collectionName,
        fileName,
        typedKeyPath,
        componentNames,
      }),
    );
  };

  /**
   * Callback for the `MutationObserver` to detect added and removed nodes in the container. It
   * renders component previews for added nodes and unmounts React roots for removed nodes. Also
   * handles replacing the URLs of images, videos and audio for media fields.
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

        if (element.matches(MEDIA_QUERY_SELECTOR)) {
          replaceMediaURLs(element);
        }

        element.querySelectorAll(MEDIA_QUERY_SELECTOR).forEach((media) => {
          replaceMediaURLs(media);
        });
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
   * sanitizing the result if needed. An HTML value is only sanitized.
   * @param {string} block The markdown block to parse, or the whole HTML value.
   * @returns {string} The parsed (and possibly sanitized) HTML string.
   */
  const parseMarkdown = (block) => {
    // Re-parse once a grammar has loaded, so the renderer can highlight what it previously couldn’t
    void highlighterVersion;

    const rawHTML = isHTML ? block : /** @type {string} */ (parse(block, { breaks: true }));

    return doSanitize ? sanitizeRichTextHTML(rawHTML) : rawHTML;
  };

  $effect(() => {
    if (markdown && !isHTML) {
      preloadHighlighter(markdown);
    }
  });

  $effect(() => {
    // Watch the assets of the previews computed along with the latest Markdown
    void markdown;
    refreshOnAssetURLChange(newPreviewAssets);
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

<div role="none" data-rich-text-preview bind:this={container}>
  {#if observerReady && markdown}
    {#each keyedBlocks as { key, block } (key)}
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
    /* Make the preview the containing block of any positioned element in the content, so an element
       with `position: fixed` from an inline style can’t cover the rest of the app */
    translate: 0;

    :global {
      [data-component-key] {
        display: contents;
      }
    }
  }
</style>
