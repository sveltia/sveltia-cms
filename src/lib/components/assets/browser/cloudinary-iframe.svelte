<script>
  import { _ } from '@sveltia/i18n';
  import { Modal } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import {
    CONSOLE_BASE_URL,
    dialogOpen,
    FRAME_SRC_PARAMS,
    getLibraryOptions,
  } from '$lib/services/integrations/media-libraries/cloud/cloudinary';

  let src = $state('');
  let mlId = $state('');

  onMount(() => {
    const options = getLibraryOptions();
    const { cloud_name: cloudName, api_key: apiKey } = (options ? options.config : undefined) ?? {};

    if (!options || !cloudName || !apiKey) {
      return;
    }

    mlId = window.crypto.randomUUID();

    const params = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(options.config ?? {}).filter(([k]) => FRAME_SRC_PARAMS.includes(k)),
      ),
      ml_id: mlId,
      pmHost: window.location.origin,
      new_cms: 'true',
    });

    src = `${CONSOLE_BASE_URL}/cms?${params}`;
  });
</script>

{#if src}
  <!-- Keep the content so that the iframe is not destroyed when the modal is closed -->
  <Modal bind:open={$dialogOpen} keepContent>
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
</style>
