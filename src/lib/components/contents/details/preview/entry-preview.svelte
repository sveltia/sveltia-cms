<script>
  import { sleep } from '@sveltia/utils/misc';
  import { sanitize } from 'isomorphic-dompurify';
  import { mount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import Placeholder from '$lib/components/common/placeholder.svelte';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { customPreviewStyle } from '$lib/services/contents/draft/editor';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  const fields = $derived($entryDraft?.fields ?? []);

  /**
   * Reference to the iframe element used for custom preview.
   * @type {HTMLIFrameElement | undefined}
   */
  let iframe = $state();

  /**
   * Whether to use a custom stylesheet registered with the `CMS.registerPreviewStyle()` API.
   * @type {boolean}
   * @see https://decapcms.org/docs/customization/
   */
  const useCustomPreviewStyle = !!customPreviewStyle.href;

  /**
   * Generate the HTML content for the iframe.
   * @returns {string} The HTML string.
   */
  const generateIframeHTML = () => `
    <!DOCTYPE html>
    <html lang="${sanitize(locale)}">
    <head>
      <meta charset="UTF-8">
      <link rel="stylesheet" href="${sanitize(customPreviewStyle.href)}">
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
      // eslint-disable-next-line no-use-before-define
      mount(Placeholder, { target, props: { children } });
    }
  };

  /**
   * Initialize the iframe with a custom stylesheet.
   */
  const initializeIframe = () => {
    if (iframe) {
      const blob = new Blob([generateIframeHTML()], { type: 'text/html' });

      iframe.addEventListener('load', mountPlaceholder, { once: true });
      iframe.src = URL.createObjectURL(blob);
    }
  };

  $effect(() => {
    if (useCustomPreviewStyle && iframe) {
      initializeIframe();
    }
  });
</script>

{#snippet children()}
  {#each fields as fieldConfig (fieldConfig.name)}
    {#await sleep() then}
      <FieldPreview keyPath={fieldConfig.name} {locale} {fieldConfig} />
    {/await}
  {/each}
{/snippet}

{#if useCustomPreviewStyle}
  <iframe class="preview" title={$_('content_preview')} bind:this={iframe}></iframe>
{:else}
  <div role="document" aria-label={$_('content_preview')}>
    {@render children()}
  </div>
{/if}

<style lang="scss">
  div {
    padding: 8px 16px;
  }

  iframe {
    display: block;
    border: none;
    width: 100%;
    height: 100%;
  }
</style>
