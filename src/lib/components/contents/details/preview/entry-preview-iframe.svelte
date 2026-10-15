<!--
  @component Implement iframe for custom preview styles and React preview templates.
  @see https://decapcms.org/docs/customization/
  @see https://sveltiacms.app/en/docs/api/preview-styles
  @see https://sveltiacms.app/en/docs/api/preview-templates
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Placeholder } from '@sveltia/ui';
  import { createElement } from 'react';
  import { mount, unmount } from 'svelte';

  import { assetURLUpdates } from '$lib/services/api/asset-proxy';
  import { loadReactDom } from '$lib/services/api/react-dom';
  import {
    createEntryDraftMountContext,
    getEntryDraftContext,
  } from '$lib/services/contents/draft/state.svelte';
  import { highlightPreviewTemplateField } from '$lib/services/contents/editor/fields';
  import { buildPreviewFrameHTML } from '$lib/services/contents/editor/preview-frame';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';

  /**
   * @import { ComponentType } from 'react';
   * @import { Root } from 'react-dom/client';
   * @import { Snippet } from 'svelte';
   * @import { InternalLocaleCode } from '$lib/types/private';
   * @import { CustomPreviewTemplateProps } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {string[]} styleURLs Custom stylesheet URLs to apply in the iframe.
   * @property {Snippet} [children] Preview content to render inside the iframe (for Svelte).
   * @property {ComponentType<CustomPreviewTemplateProps>} [reactComponent] React component to
   * render (for custom preview templates).
   * @property {Omit<CustomPreviewTemplateProps, 'document' | 'window'>} [reactProps] Props for the
   * React component, except for the `document` and `window` props, which will be automatically
   * provided by the iframe.
   * @property {(iframe: HTMLIFrameElement) => void} [onLoad] Function called with the iframe once
   * its content has been loaded and mounted.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    styleURLs,
    children,
    reactComponent,
    reactProps,
    onLoad,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Track if the iframe has been initialized to avoid duplicate initialization.
   * @type {boolean}
   */
  let initialized = $state(false);
  /**
   * Reference to the iframe element used for custom preview.
   * @type {HTMLIFrameElement | undefined}
   */
  let iframe = $state();
  /**
   * Reference to the React root inside the iframe.
   * @type {Root | undefined}
   */
  let reactRoot = $state();
  /**
   * Svelte placeholder mounted inside the iframe. It’s outside the component tree, so it has to be
   * unmounted explicitly, or its effects would keep running after the iframe is gone.
   * @type {Record<string, any> | undefined}
   */
  let placeholder;

  /** Language of the frame’s document, unless the locale isn’t a valid language tag. */
  const lang = $derived(getCanonicalLocale(locale));
  /**
   * Text direction of the frame’s document. Without i18n, the locale doesn’t tell the language, so
   * the direction is left to the template rather than set to `auto`, which would turn the whole
   * document right-to-left whenever its first text is in a right-to-left script.
   */
  const dir = $derived(locale === '_default' ? undefined : getDirection(locale));

  /**
   * Mount the Svelte placeholder component into the iframe’s body. This way, the iframe content
   * becomes reactive and can be updated when the fields change. The mounted component is outside
   * the Svelte component tree, so the entry draft state is passed to it as a mount context; the
   * field previews rendered by `children` read it from there.
   */
  const mountPlaceholder = () => {
    const target = iframe?.contentDocument?.body;

    /* v8 ignore next 3 -- the frame has just loaded, so it’s there */
    if (!target) {
      return;
    }

    placeholder = mount(Placeholder, {
      target,
      context: createEntryDraftMountContext(entryDraft),
      props: { children },
    });
  };

  /**
   * Render the React component with the current props.
   */
  const renderReactComponent = () => {
    const { contentDocument, contentWindow } = /** @type {HTMLIFrameElement} */ (iframe);

    /* v8 ignore next 3 -- the effect below only calls this once the root is in the frame */
    if (!reactRoot || !reactComponent || !reactProps || !contentDocument || !contentWindow) {
      return;
    }

    const componentProps = {
      ...reactProps,
      document: contentDocument,
      window: contentWindow,
    };

    reactRoot.render(createElement(reactComponent, componentProps));
  };

  /**
   * Mount the React component into the iframe’s body.
   */
  const mountReactComponent = async () => {
    /* v8 ignore next 3 -- only called when a React component is given */
    if (!reactComponent) {
      return;
    }

    // Loaded on demand, as only a custom preview template renders React here. It’s normally on
    // its way already, as `CMS.registerPreviewTemplate()` starts loading it
    const { createRoot } = await loadReactDom();
    const contentDocument = iframe?.contentDocument;
    const target = contentDocument?.body;

    /* v8 ignore next 3 -- the frame may have been removed while the library was loading */
    if (!contentDocument || !target) {
      return;
    }

    /**
     * Highlight the Edit Pane field corresponding to an element the template has marked with the
     * `data-key-path` attribute. The listeners go away with the frame’s document.
     * @param {MouseEvent | KeyboardEvent} event `click` or `keydown` event.
     */
    const listener = (event) => {
      highlightPreviewTemplateField({ event, locale });
    };

    contentDocument.addEventListener('click', listener);
    contentDocument.addEventListener('keydown', listener);

    // Create React root in the iframe; the update $effect will handle the first render
    reactRoot = createRoot(target);
  };

  /* v8 ignore start -- mounting only fails when the library can’t be loaded */
  /**
   * Report a failure to mount the content.
   * @param {Error} error Error.
   */
  const reportMountError = (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
  };
  /* v8 ignore stop */

  /**
   * Initialize the iframe with a custom stylesheet.
   */
  const initializeIframe = () => {
    /* v8 ignore next 3 -- the effect below only calls this once, when the frame is there */
    if (!iframe || initialized) {
      return;
    }

    const mountComponent = reactComponent ? mountReactComponent : mountPlaceholder;
    const html = buildPreviewFrameHTML({ lang, dir, styleURLs, origin: window.location.origin });
    const blobURL = URL.createObjectURL(new Blob([html], { type: 'text/html' }));

    /**
     * Callback function to be called when the iframe has loaded its content. It mounts either the
     * React component or the Svelte placeholder, depending on which is provided. It also revokes
     * the iframe’s blob URL, which is no longer needed after the iframe has loaded.
     */
    const listener = async () => {
      try {
        await mountComponent();
      } catch (/** @type {any} */ error) {
        /* v8 ignore next -- mounting only fails when the library can’t be loaded */
        reportMountError(error);
      }

      URL.revokeObjectURL(blobURL);
      initialized = true;
      onLoad?.(/** @type {HTMLIFrameElement} */ (iframe));
    };

    iframe.addEventListener('load', listener, { once: true });
    iframe.src = blobURL;
  };

  // Initialize iframe once
  $effect(() => {
    if (iframe && !initialized) {
      initializeIframe();
    }
  });

  // Update the language and direction once the pane shows another locale, which doesn’t load the
  // frame again
  $effect(() => {
    const root = initialized ? iframe?.contentDocument?.documentElement : undefined;

    if (!root) {
      return;
    }

    if (lang) {
      root.lang = lang;
    } else {
      root.removeAttribute('lang');
    }

    if (dir) {
      root.dir = dir;
    } else {
      root.removeAttribute('dir');
    }
  });

  // Update React component when reactProps changes
  $effect(() => {
    // Render again once an asset the component got with `getAsset()` has a blob URL
    void assetURLUpdates.current;

    // Only update if we have a React root and the iframe is initialized
    if (initialized && reactRoot && reactComponent && reactProps) {
      renderReactComponent();
    }
  });

  // Cleanup on unmount
  $effect(() => () => {
    reactRoot?.unmount();

    if (placeholder) {
      unmount(placeholder);
    }
  });
</script>

<iframe
  class="preview"
  title={_('content_preview')}
  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
  bind:this={iframe}
></iframe>

<style>
  iframe {
    display: block;
    border: none;
    width: 100%;
    height: 100%;
  }
</style>
