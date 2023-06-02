<script>
  /**
   * @type {HTMLInputElement}
   */
  let filePicker = undefined;

  /**
   * @type {string}
   */
  export let accept = undefined;
  export let multiple = false;

  /**
   * Show the browser’s file picker dialog.
   */
  export const open = () => {
    filePicker?.click();
  };
</script>

<input type="file" hidden {accept} {multiple} bind:this={filePicker} on:change />
