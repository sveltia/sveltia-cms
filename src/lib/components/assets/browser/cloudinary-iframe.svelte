<script>
  import { _ } from '@sveltia/i18n';
  import { Modal } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import {
    CONSOLE_BASE_URL,
    consoleLoaded,
    dialogOpen,
    FRAME_SRC_PARAMS,
    getLibraryOptions,
    parseMessage,
  } from '$lib/services/integrations/media-libraries/cloud/cloudinary';

  let src = $state('');
  let mlId = $state('');

  /**
   * Handle the `consoleLoaded` message from the iframe. It’s handled here rather than in the
   * Cloudinary panel, because the iframe is loaded at startup and can send the message before the
   * panel is mounted, in which case the panel would never configure the widget.
   * @param {MessageEvent} event The message event.
   * @see https://github.com/sveltia/sveltia-cms/issues/1125
   */
  const onMessage = (event) => {
    if (parseMessage(event)?.type === 'consoleLoaded') {
      consoleLoaded.current = true;
    }
  };

  onMount(() => {
    // A new iframe, e.g. after signing in again, has to load the console first
    consoleLoaded.current = false;

    const options = getLibraryOptions();

    if (!options) {
      return;
    }

    const { cloud_name: cloudName, api_key: apiKey } = options.config ?? {};

    if (!cloudName || !apiKey) {
      return;
    }

    mlId = window.crypto.randomUUID();

    const params = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(/** @type {Record<string, any>} */ (options.config)).filter(([k]) =>
          FRAME_SRC_PARAMS.includes(k),
        ),
      ),
      ml_id: mlId,
      pmHost: window.location.origin,
      new_cms: 'true',
    });

    src = `${CONSOLE_BASE_URL}/cms?${params}`;
  });
</script>

<svelte:window onmessage={onMessage} />

{#if src}
  <!-- Keep the content so that the iframe is not destroyed when the modal is closed -->
  <Modal bind:open={dialogOpen.current} keepContent>
    <iframe
      {src}
      id="cloudinary-iframe"
      title={_('cloud_storage.cloudinary.iframe_title')}
      allow="camera; storage-access"
      sandbox="allow-same-origin allow-scripts allow-popups allow-forms
        allow-storage-access-by-user-activation"
      data-ml-id={mlId}
    >
    </iframe>
  </Modal>
{/if}

<style>
  iframe {
    display: block;
    width: calc(100% - 32px);
    height: calc(100% - 32px);
    border: none;
  }

  /* Avoid scrolling issue https://github.com/sveltia/sveltia-cms/issues/824 */
  :global(dialog[inert]) > iframe {
    display: none;
  }
</style>
