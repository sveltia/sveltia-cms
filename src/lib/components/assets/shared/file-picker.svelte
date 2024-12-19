<script>
  /**
   * @type {HTMLInputElement}
   */
  let filePicker;

  /**
   * @type {string | undefined}
   */
  export let accept = undefined;
  export let multiple = false;
  /**
   * Custom `select` event handler.
   * @type {((detail: { files: File[], file: File }) => void) | undefined}
   */
  export let onSelect = undefined;

  /**
   * Show the browser’s file picker dialog.
   */
  export const open = () => {
    filePicker?.click();
  };
</script>

<input
  type="file"
  hidden
  {accept}
  {multiple}
  bind:this={filePicker}
  on:change={({ target }) => {
    const files = [.../** @type {FileList} */ (/** @type {HTMLInputElement} */ (target).files)];

    onSelect?.({ files, file: files[0] });
  }}
  on:cancel|stopPropagation
/>
