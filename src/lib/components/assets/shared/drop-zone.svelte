<script>
  import { AlertDialog, Button, FilePicker, Icon } from '@sveltia/ui';
  import { scanFiles } from '@sveltia/utils/file';
  import { onMount } from 'svelte';
  import { _, locale as appLocale } from 'svelte-i18n';
  import UploadAssetsPreview from '$lib/components/assets/shared/upload-assets-preview.svelte';
  import { getListFormatter } from '$lib/services/contents/i18n';
  import { hasMouse } from '$lib/services/user/env';
  import { supportedImageTypes } from '$lib/services/utils/media/image';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} [accept] The `accept` attribute for the `<input type="file">`.
   * @property {boolean} [disabled] Whether to disable new file selection.
   * @property {boolean} [multiple] Whether to accept multiple files.
   * @property {boolean} [showUploadButton] Whether to show the upload button.
   * @property {boolean} [showFilePreview] Whether to show file preview after files are selected.
   * @property {(detail: { files: File[] }) => void} [onDrop] Custom `Drop` event handler.
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    accept = undefined,
    disabled = false,
    multiple = false,
    showUploadButton = false,
    showFilePreview = false,
    onDrop = undefined,
    children = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLElement | undefined} */
  let dropTarget = $state();
  let dragging = $state(false);
  let typeMismatch = $state(false);
  let showTypeMismatchAlertDialog = $state(false);
  /** @type {FilePicker | undefined} */
  let filePicker = $state();
  /** @type {File[]}  */
  let files = $state([]);

  const showDefaultContent = $derived(showUploadButton || (showFilePreview && files.length));

  /**
   * Open the file picker to let the user choose file(s).
   */
  export const openFilePicker = () => {
    filePicker?.open();
  };

  /**
   * Reset the file list.
   */
  export const reset = () => {
    files = [];
    onDrop?.({ files });
  };

  /**
   * Cache the selected files, and notify the list.
   * @param {File[]} allFiles Files.
   */
  const updateFileList = (allFiles) => {
    files = multiple ? allFiles : allFiles.slice(0, 1);
    onDrop?.({ files });
  };

  onMount(() => {
    dropTarget?.addEventListener('Select', (event) => {
      onDrop?.({ files: /** @type {CustomEvent} */ (event).detail.files });
    });
  });

  $effect(() => {
    if (!showDefaultContent && typeMismatch) {
      showTypeMismatchAlertDialog = true;
    }
  });
</script>

{#snippet typeMismatchAlert()}
  {#if accept === supportedImageTypes.join(',')}
    {$_('dropped_image_type_mismatch')}
  {:else}
    {$_('dropped_file_type_mismatch', {
      values: {
        type: getListFormatter(/** @type {string} */ ($appLocale), {
          type: 'disjunction',
        }).format(/** @type {string} */ (accept).split(/,\s*/)),
      },
    })}
  {/if}
{/snippet}

<div
  bind:this={dropTarget}
  role="none"
  class="drop-target"
  ondragover={(event) => {
    event.preventDefault();

    if (disabled || !event.dataTransfer) {
      return;
    }

    event.dataTransfer.dropEffect = 'copy';
    dragging = true;
    typeMismatch = false;
  }}
  ondragleave={(event) => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    dragging = false;
  }}
  ondragend={(event) => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    dragging = false;
  }}
  ondrop={async (event) => {
    event.preventDefault();

    if (disabled || !event.dataTransfer) {
      return;
    }

    dragging = false;

    const filteredFileList = await scanFiles(event.dataTransfer, { accept });

    if (filteredFileList.length) {
      updateFileList(filteredFileList);
    } else {
      typeMismatch = true;
    }
  }}
>
  <!--
    File(s) can be selected when `openFilePicker()` is called from outside the component, typically
    with an external upload button. In that case, the file preview, if enabled, should replace the
    default slot content.
  -->
  {#if showDefaultContent}
    <div role="none" class="content">
      {#if showUploadButton}
        <div role="none">
          {#if $hasMouse}
            {$_(multiple ? 'drop_files_or_click_to_browse' : 'drop_file_or_click_to_browse')}
          {:else}
            {$_('tap_to_browse')}
          {/if}
        </div>
        <div role="none">
          <Button
            variant="primary"
            label={$_(multiple ? 'choose_files' : 'choose_file')}
            {disabled}
            onclick={() => {
              openFilePicker();
            }}
          >
            {#snippet startIcon()}
              <Icon name="cloud_upload" />
            {/snippet}
          </Button>
        </div>
        {#if typeMismatch}
          <div role="alert">
            {@render typeMismatchAlert()}
          </div>
        {/if}
      {/if}
      {#if showFilePreview && files.length}
        <UploadAssetsPreview bind:files />
      {/if}
    </div>
  {:else}
    {@render children?.()}
  {/if}
  {#if dragging}
    <div role="none" class="drop-indicator">
      <div role="none">
        <Icon name="download" />
        <span role="none">{$_(multiple ? 'drop_files_here' : 'drop_file_here')}</span>
      </div>
    </div>
  {/if}
</div>

<FilePicker
  {accept}
  {multiple}
  bind:this={filePicker}
  onSelect={({ files: _files }) => {
    updateFileList(_files);
  }}
/>

{#if !showDefaultContent}
  <AlertDialog bind:open={showTypeMismatchAlertDialog} title={$_('unsupported_file_type')}>
    {@render typeMismatchAlert()}
  </AlertDialog>
{/if}

<style lang="scss">
  .drop-target {
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    height: 100%;
    pointer-events: auto;

    :global {
      & > .group {
        overflow-y: auto;
        padding: 16px;
        width: 100%;
        height: 100%;
      }

      button:not(:disabled) {
        pointer-events: auto;
      }
    }
  }

  .drop-indicator {
    position: absolute;
    inset: 0;
    z-index: 10;
    border-radius: var(--sui-control-large-border-radius);
    background-color: hsl(var(--sui-background-color-4-hsl) / 80%);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    text-align: center;
    pointer-events: none;

    div {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      gap: 4px;
      border: 4px dashed var(--sui-primary-accent-color);
      border-radius: var(--sui-control-large-border-radius);
      font-size: var(--sui-font-size-x-large);

      :global(.icon) {
        color: var(--sui-secondary-foreground-color);
        font-size: 48px;
      }
    }
  }

  .content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    overflow: auto;
    height: 100%;
    min-height: 320px;
    text-align: center;
  }
</style>
