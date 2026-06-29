<!--
  @component Implement iframe for custom preview styles and React preview templates.
  @see https://decapcms.org/docs/customization/
  @see https://sveltiacms.app/en/docs/api/preview-styles
  @see https://sveltiacms.app/en/docs/api/preview-templates
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { createElement } from 'react';
  import { createRoot } from 'react-dom/client';
  import { mount } from 'svelte';

  import Placeholder from '$lib/components/common/placeholder.svelte';
  import { escapeAttr } from '$lib/services/utils/string';

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
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    styleURLs,
    children,
    reactComponent,
    reactProps,
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
   * Generate the HTML content for the iframe.
   * @returns {string} The HTML string.
   */
  const generateHTML = () => `
    <!DOCTYPE html>
    <html lang="${escapeAttr(locale)}">
    <head>
      <meta charset="UTF-8">
      <base href="${escapeAttr(window.location.origin)}" target="_blank">
      ${styleURLs.map((url) => `<link rel="stylesheet" href="${escapeAttr(url)}">`).join('\n')}
    </head>
    <body></body>
    </html>
  `;

  /**
   * Mount the Svelte placeholder component into the iframe’s body. This way, the iframe content
   * becomes reactive and can be updated when the fields change.
   */
  const mountPlaceholder = () => {
    const target = iframe?.contentDocument?.body;

    if (target) {
      mount(Placeholder, { target, props: { children } });
    }
  };

  /**
   * Render the React component with the current props.
   */
  const renderReactComponent = () => {
    const { contentDocument, contentWindow } = iframe ?? {};

    if (reactRoot && reactComponent && reactProps && contentDocument && contentWindow) {
      const componentProps = {
        ...reactProps,
        document: contentDocument,
        window: contentWindow,
      };

      reactRoot.render(createElement(reactComponent, componentProps));
    }
  };

  /**
   * Mount the React component into the iframe’s body.
   */
  const mountReactComponent = () => {
    const target = iframe?.contentDocument?.body;

    if (target && reactComponent) {
      // Create React root in the iframe; the update $effect will handle the first render
      reactRoot = createRoot(target);
    }
  };

  /**
   * Initialize the iframe with a custom stylesheet.
   */
  const initializeIframe = () => {
    if (!iframe || initialized) {
      return;
    }

    const mountComponent = reactComponent ? mountReactComponent : mountPlaceholder;
    const blobURL = URL.createObjectURL(new Blob([generateHTML()], { type: 'text/html' }));

    /**
     * Callback function to be called when the iframe has loaded its content. It mounts either the
     * React component or the Svelte placeholder, depending on which is provided. It also revokes
     * the iframe’s blob URL, which is no longer needed after the iframe has loaded.
     */
    const listener = () => {
      mountComponent();
      URL.revokeObjectURL(blobURL);
      initialized = true;
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

  // Update React component when reactProps changes
  $effect(() => {
    // Only update if we have a React root and the iframe is initialized
    if (initialized && reactRoot && reactComponent && reactProps) {
      renderReactComponent();
    }
  });

  // Cleanup on unmount
  $effect(() => () => {
    reactRoot?.unmount();
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
