<!--
  @component Cloudinary media library panel component. This is a minimal implementation of the
  Cloudinary Media Library widget embedded in an iframe. It sets up the iframe source URL with
  necessary query parameters and handles communication with the iframe via `postMessage`. This way,
  we don’t need to load the third-party script directly in our application.
  @see https://cloudinary.com/documentation/media_library_widget
  @see https://media-library.cloudinary.com/global/all.js
-->
<script>
  import { Button, EmptyState } from '@sveltia/ui';
  import { isObject } from '@sveltia/utils/object';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';

  import {
    CONFIG_PROPS,
    FRAME_ORIGIN,
    FRAME_SRC_PARAMS,
    getMergedLibraryOptions,
  } from '$lib/services/integrations/media-libraries/cloud/cloudinary';

  /**
   * @import { MediaLibraryAssetKind, SelectedResource } from '$lib/types/private';
   * @import { CloudinaryMediaLibrary, MediaField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MediaField} [fieldConfig] File/Image field configuration.
   * @property {MediaLibraryAssetKind} [kind] Asset kind.
   * @property {boolean} [multiple] Whether to allow selecting multiple assets.
   * @property {boolean} [hidden] Whether the panel is hidden.
   * @property {(resources: SelectedResource[]) => void} onSelect Custom `Select` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    fieldConfig,
    kind,
    multiple = false,
    hidden = false,
    onSelect,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {CloudinaryMediaLibrary} */
  const libOptions = $derived(getMergedLibraryOptions(fieldConfig) ?? {});

  let mlId = '';
  let authenticated = $state(false);
  let consoleLoaded = $state(false);
  /** @type {HTMLIFrameElement | undefined} */
  let iframe = $state();

  /**
   * Set the iframe src URL with appropriate query parameters.
   */
  const initFrame = () => {
    if (!iframe) {
      return;
    }

    mlId = window.crypto.randomUUID();

    const params = new URLSearchParams({
      ...Object.fromEntries(
        Object.entries(libOptions.config ?? {}).filter(([k]) => FRAME_SRC_PARAMS.includes(k)),
      ),
      ml_id: mlId,
      pmHost: window.location.origin,
      new_cms: 'true',
      remove_header: 'true',
    });

    iframe.src = `https://console.cloudinary.com/console/media_library/cms?${params}`;
  };

  /**
   * Send configuration message to the Cloudinary Media Library iframe.
   */
  const sendMessage = () => {
    const config = {
      ...Object.fromEntries(
        Object.entries(libOptions.config ?? {}).filter(([k]) => CONFIG_PROPS.includes(k)),
      ),
      multiple,
      max_files: fieldConfig?.max ?? libOptions.config?.max_files ?? 20,
      folder: {
        path: libOptions.config?.folder?.path ?? '',
        resource_type: kind ?? 'raw',
      },
    };

    const data = {
      type: 'ML_WIDGET_SHOW',
      data: { mlId, config },
    };

    // eslint-disable-next-line no-console
    console.debug('Cloudinary Panel sending message:', data);

    iframe?.contentWindow?.postMessage(JSON.stringify(data), FRAME_ORIGIN);
  };

  /**
   * Handle asset insertion from the Cloudinary Media Library.
   * @param {{ assets: { secure_url: string; derived?: { secure_url: string }[] }[] }} assets The
   * inserted assets data.
   */
  const onInsert = ({ assets }) => {
    const {
      output_filename_only: outputFilenameOnly = false,
      use_transformations: useTransformations = true,
    } = libOptions;

    /** @type {SelectedResource[]} */
    const resources = assets.map((asset) => {
      const url = asset.secure_url;

      if (outputFilenameOnly) {
        return { url: /** @type {string} */ (url.split('/').pop()) };
      }

      if (useTransformations) {
        return { url: asset.derived?.[0]?.secure_url ?? url };
      }

      return { url };
    });

    onSelect(resources);
  };

  /**
   * Handle messages received from the Cloudinary Media Library iframe.
   * @param {MessageEvent} event The message event.
   */
  const onMessage = ({ origin, data }) => {
    if (origin !== FRAME_ORIGIN) {
      return;
    }

    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }

    if (!isObject(data)) {
      return;
    }

    // eslint-disable-next-line no-console
    console.debug('Cloudinary Panel received message:', data);

    if (data.type === 'login' && data.consoleDomain) {
      authenticated = true;
    }

    if (data.type === 'consoleLoaded') {
      consoleLoaded = true;
    }

    if (data.type === 'ML_WIDGET_INSERT_DATA') {
      onInsert(data.data);
    }
  };

  onMount(() => {
    initFrame();
    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('message', onMessage);
    };
  });

  $effect(() => {
    if (libOptions && consoleLoaded) {
      sendMessage();
    }
  });
</script>

<iframe
  bind:this={iframe}
  title={$_('cloud_storage.cloudinary.iframe_title')}
  hidden={hidden || !authenticated}
  allow="camera; storage-access"
>
</iframe>

{#if !authenticated}
  <EmptyState>
    <Button
      variant="primary"
      label={$_('cloud_storage.cloudinary.activate.button_label')}
      onclick={async () => {
        // Let the user sign in to Cloudinary first in a separate tab, otherwise third-party cookies
        // in the iframe won’t work, and authentication will fail.
        window.open('https://console.cloudinary.com/console/media_library/cms_login?cms=true');
      }}
    />
    <div role="none">{$_('cloud_storage.cloudinary.activate.description')}</div>
  </EmptyState>
{/if}

<style>
  iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: none;

    &[hidden] {
      display: none;
    }
  }
</style>
