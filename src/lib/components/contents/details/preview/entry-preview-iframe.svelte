<!--
  @component Implement iframe for custom preview styles.
  @see https://decapcms.org/docs/customization/
-->
<script>
  import { sanitize } from 'isomorphic-dompurify';
  import { mount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import Placeholder from '$lib/components/common/placeholder.svelte';

  /**
   * @import { Snippet } from 'svelte';
   * @import { InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {string} styleURL URL of the custom stylesheet to apply in the iframe.
   * @property {Snippet} children Preview content to render inside the iframe.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    styleURL,
    children,
    /* eslint-enable prefer-const */
  } = $props();

  /**
   * Reference to the iframe element used for custom preview.
   * @type {HTMLIFrameElement | undefined}
   */
  let iframe = $state();

  /**
   * Generate the HTML content for the iframe.
   * @returns {string} The HTML string.
   */
  const generateHTML = () => `
    <!DOCTYPE html>
    <html lang="${sanitize(locale)}">
    <head>
      <meta charset="UTF-8">
      <link rel="stylesheet" href="${sanitize(styleURL)}">
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
   * Initialize the iframe with a custom stylesheet.
   */
  const initializeIframe = () => {
    if (iframe) {
      iframe.addEventListener('load', mountPlaceholder, { once: true });
      iframe.src = URL.createObjectURL(new Blob([generateHTML()], { type: 'text/html' }));
    }
  };

  $effect(() => {
    if (iframe) {
      initializeIframe();
    }
  });
</script>

<iframe class="preview" title={$_('content_preview')} bind:this={iframe}></iframe>

<style lang="scss">
  iframe {
    display: block;
    border: none;
    width: 100%;
    height: 100%;
  }
</style>
