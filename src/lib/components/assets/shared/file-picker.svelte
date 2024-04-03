<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

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

    dispatch('select', { files, file: files[0] });
  }}
  on:cancel|stopPropagation
/>
