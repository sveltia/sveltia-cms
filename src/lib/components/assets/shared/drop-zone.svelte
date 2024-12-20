<script>
  import { Button, Icon } from '@sveltia/ui';
  import { scanFiles } from '@sveltia/utils/file';
  import { _ } from 'svelte-i18n';
  import UploadAssetsPreview from '$lib/components/assets/shared/upload-assets-preview.svelte';
  import FilePicker from '$lib/components/assets/shared/file-picker.svelte';

  /**
   * @typedef {object} Props
   * @property {string} [accept] - The `accept` attribute for the `<input type="file">`.
   * @property {boolean} [disabled] - Whether to disable new file selection.
   * @property {boolean} [multiple] - Whether to accept multiple files.
   * @property {boolean} [showUploadButton] - Whether to show the upload button.
   * @property {boolean} [showFilePreview] - Whether to show file preview after files are selected.
   * @property {(detail: { files: File[] }) => void} [onSelect] - Custom `select` event handler.
   * @property {import('svelte').Snippet} [children] - Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    accept = undefined,
    disabled = false,
    multiple = false,
    showUploadButton = false,
    showFilePreview = false,
    onSelect = undefined,
    children = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  let dragging = $state(false);
  let typeMismatch = $state(false);
  /** @type {FilePicker | undefined} */
  let filePicker = $state();
  /** @type {File[]}  */
  let files = $state([]);

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
    onSelect?.({ files });
  };

  /**
   * Cache the selected files, and notify the list.
   * @param {File[]} allFiles - Files.
   */
  const updateFileList = (allFiles) => {
    files = multiple ? allFiles : allFiles.slice(0, 1);
    onSelect?.({ files });
  };
</script>

<div
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
  {#if showUploadButton || (showFilePreview && files.length)}
    <div role="none" class="content">
      {#if showUploadButton}
        <div role="none">{$_(multiple ? 'drop_or_browse_files' : 'drop_or_browse_file')}</div>
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
          <div role="alert">{$_('drop_files_type_mismatch', { values: { type: accept } })}</div>
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

<style lang="scss">
  .drop-target {
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    height: 100%;
    pointer-events: auto;

    & > :global(.group) {
      overflow-y: auto;
      padding: 16px;
      width: 100%;
      height: 100%;
    }

    & > * {
      pointer-events: none;
    }

    :global(button) {
      pointer-events: auto;
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
