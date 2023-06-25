<script>
  import { Button, Icon } from '@sveltia/ui';
  import { createEventDispatcher } from 'svelte';
  import { _ } from 'svelte-i18n';
  import FilePicker from '$lib/components/assets/shared/file-picker.svelte';
  import UploadAssetsPreview from '$lib/components/assets/shared/upload-assets-preview.svelte';
  import { scanFiles } from '$lib/services/utils/files';

  /**
   * @type {string}
   */
  export let accept = undefined;
  export let multiple = false;
  export let showUploadButton = false;
  export let showFilePreview = false;

  const dispatch = createEventDispatcher();
  let dragging = false;
  /**
   * @type {import('svelte').SvelteComponent}
   */
  let filePicker = undefined;
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
   * Cache the selected files, and notify the list.
   * @param {File[]} allFiles Files.
   */
  const onSelect = (allFiles) => {
    files = multiple ? allFiles : allFiles.slice(0, 1);
  };

  $: dispatch('select', { files });
</script>

<div
  class="drop-target"
  role="none"
  on:dragover|preventDefault={({ dataTransfer }) => {
    dataTransfer.dropEffect = 'copy';
    dragging = true;
  }}
  on:dragleave|preventDefault={() => {
    dragging = false;
  }}
  on:dragend|preventDefault={() => {
    dragging = false;
  }}
  on:drop|preventDefault={async ({ dataTransfer }) => {
    dragging = false;
    onSelect(await scanFiles(dataTransfer, { accept }));
  }}
>
  <!--
    File(s) can be selected when `openFilePicker()` is called from outside the component, typically
    with an external upload button. In that case, the file preview, if enabled, should replace the
    default slot content.
  -->
  {#if !showUploadButton && showFilePreview && files.length}
    <div class="content">
      <UploadAssetsPreview bind:files />
    </div>
  {:else if $$slots.default}
    <slot />
  {:else}
    <div class="content">
      {#if showUploadButton}
        <div>{$_('drop_files_or_browse')}</div>
        <div>
          <Button
            class="primary"
            label={$_('upload')}
            on:click={() => {
              openFilePicker();
            }}
          >
            <Icon slot="start-icon" name="cloud_upload" />
          </Button>
        </div>
      {/if}
      {#if showFilePreview && files.length}
        <UploadAssetsPreview bind:files />
      {/if}
    </div>
  {/if}
  {#if dragging}
    <div class="drop-indicator">
      <div>{$_('drop_files_here')}</div>
    </div>
  {/if}
</div>

<FilePicker
  {accept}
  {multiple}
  bind:this={filePicker}
  on:change={({ target }) => {
    onSelect([.../** @type {HTMLInputElement} */ (target).files]);
  }}
/>

<style lang="scss">
  .drop-target {
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    overflow: auto;
    pointer-events: auto;

    & * {
      pointer-events: none;
    }
  }

  .drop-indicator {
    position: absolute;
    inset: 0;
    z-index: 10;
    background-color: hsl(var(--background-color-4-hsl) / 80%);
    backdrop-filter: blur(8px);
    pointer-events: none;

    div {
      position: absolute;
      inset: 32px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: var(--font-size--xxx-large);
      border-width: 8px;
      border-style: dashed;
      border-color: var(--primary-accent-color-foreground);
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
  }
</style>
