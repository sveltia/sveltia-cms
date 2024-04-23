<script>
  import { Button, Icon } from '@sveltia/ui';
  import { scanFiles } from '@sveltia/utils/file';
  import { createEventDispatcher } from 'svelte';
  import { _ } from 'svelte-i18n';
  import UploadAssetsPreview from '$lib/components/assets/shared/upload-assets-preview.svelte';
  import FilePicker from '$lib/components/assets/shared/file-picker.svelte';

  /**
   * @type {string | undefined}
   */
  export let accept = undefined;
  export let disabled = false;
  export let multiple = false;
  export let showUploadButton = false;
  export let showFilePreview = false;

  const dispatch = createEventDispatcher();
  let dragging = false;
  let typeMismatch = false;
  /**
   * @type {FilePicker}
   */
  let filePicker;
  /**
   * @type {File[]}
   */
  let files = [];

  /**
   * Open the file picker to let the user choose file(s).
   */
  export const openFilePicker = () => {
    filePicker.open();
  };

  /**
   * Reset the file list.
   */
  export const reset = () => {
    files = [];
  };

  /**
   * Cache the selected files, and notify the list.
   * @param {File[]} allFiles - Files.
   */
  const onSelect = (allFiles) => {
    files = multiple ? allFiles : allFiles.slice(0, 1);
  };

  $: dispatch('select', { files });
</script>

<div
  role="none"
  class="drop-target"
  on:dragover|preventDefault={({ dataTransfer }) => {
    if (disabled) {
      return;
    }

    /** @type {DataTransfer} */ (dataTransfer).dropEffect = 'copy';
    dragging = true;
    typeMismatch = false;
  }}
  on:dragleave|preventDefault={() => {
    if (disabled) {
      return;
    }

    dragging = false;
  }}
  on:dragend|preventDefault={() => {
    if (disabled) {
      return;
    }

    dragging = false;
  }}
  on:drop|preventDefault={async ({ dataTransfer }) => {
    if (disabled || !dataTransfer) {
      return;
    }

    dragging = false;

    const filteredFileList = await scanFiles(dataTransfer, { accept });

    if (filteredFileList.length) {
      onSelect(filteredFileList);
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
        <div role="none">{$_(multiple ? 'drop_files_or_browse' : 'drop_file_or_browse')}</div>
        <div role="none">
          <Button
            variant="primary"
            label={$_(multiple ? 'choose_files' : 'choose_file')}
            {disabled}
            on:click={() => {
              openFilePicker();
            }}
          >
            <Icon slot="start-icon" name="cloud_upload" />
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
    <slot />
  {/if}
  {#if dragging}
    <div role="none" class="drop-indicator">
      <div role="none">{$_('drop_files_here')}</div>
    </div>
  {/if}
</div>

<FilePicker
  {accept}
  {multiple}
  bind:this={filePicker}
  on:select={({ detail }) => {
    onSelect(detail.files);
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
    background-color: hsl(var(--sui-background-color-4-hsl) / 80%);
    -webkit-backdrop-filter: blur(8px);
    backdrop-filter: blur(8px);
    text-align: center;
    pointer-events: none;

    div {
      position: absolute;
      inset: 32px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: var(--sui-font-size-xxx-large);
      border-width: 8px;
      border-style: dashed;
      border-color: var(--sui-primary-accent-color-inverted);
      border-radius: 8px;
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
