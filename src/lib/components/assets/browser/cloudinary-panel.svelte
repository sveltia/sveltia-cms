<!--
  @component Cloudinary media library panel component. This is a minimal implementation of the
  Cloudinary Media Library widget embedded in an iframe. It sets up the iframe source URL with
  necessary query parameters and handles communication with the iframe via `postMessage`. This way,
  we don’t need to load the third-party script directly in our application.
  @see https://cloudinary.com/documentation/media_library_widget
  @see https://media-library.cloudinary.com/global/all.js
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, EmptyState } from '@sveltia/ui';
  import { isObject } from '@sveltia/utils/object';
  import { onMount } from 'svelte';

  import {
    activated,
    CONFIG_PROPS,
    CONSOLE_BASE_URL,
    consoleLoaded,
    dialogOpen,
    FRAME_ORIGIN,
    getMergedLibraryOptions,
  } from '$lib/services/integrations/media-libraries/cloud/cloudinary';
  import { openNewTab } from '$lib/services/utils/window';

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

  /** @type {HTMLIFrameElement | null} */
  let iframe = null;

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
      data: { mlId: iframe?.dataset?.mlId, config },
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
      $activated = true;
      $dialogOpen = true;
    }

    if (data.type === 'consoleLoaded') {
      $consoleLoaded = true;
    }

    if (data.type === 'ML_WIDGET_INSERT_DATA') {
      $dialogOpen = false;
      onInsert(data.data);
    }

    if (data.type === 'ML_WIDGET_HIDE') {
      $dialogOpen = false;
    }
  };

  onMount(() => {
    iframe = document.querySelector('iframe#cloudinary-iframe');
    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('message', onMessage);
    };
  });

  $effect(() => {
    if (libOptions && $consoleLoaded) {
      sendMessage();
    }
  });
</script>

{#if !hidden}
  <EmptyState>
    {#if $activated}
      <Button
        variant="primary"
        label={_('cloud_storage.cloudinary.open_library')}
        onclick={() => {
          $dialogOpen = true;
        }}
      />
    {:else}
      <Button
        variant="primary"
        label={_('cloud_storage.cloudinary.activate.button_label')}
        onclick={() => {
          // Let the user sign in to Cloudinary first in a separate tab, otherwise third-party
          // cookies in the iframe won’t work, and authentication will fail. Allow `window.opener`
          // so Cloudinary can send the login message back via `postMessage`.
          openNewTab(`${CONSOLE_BASE_URL}/cms_login?cms=true`, { noopener: false });
        }}
      />
      <div role="none">{_('cloud_storage.cloudinary.activate.description')}</div>
    {/if}
  </EmptyState>
{/if}
