<!--
  @component
  New Folder dialog, shared by the Asset Library and the asset picker. It creates a subfolder in the
  given directory and reports the progress and the result, but leaves the user where they are: the
  new folder is listed along with the others, ready to be opened.
-->
<script>
  import { _ } from '@sveltia/i18n';

  import SubfolderNameDialog from '$lib/components/assets/list/subfolder-name-dialog.svelte';
  import { runAssetCommit } from '$lib/services/assets/data/commit';
  import { createSubfolder } from '$lib/services/assets/data/subfolder';
  import { createPath } from '$lib/services/utils/file';

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {string} dirPath Path of the directory the folder is created in, e.g.
   * `static/images/2024`. An empty string for the repository root.
   * @property {string[]} takenNames Names of the files and folders already in the directory.
   */

  /** @type {Props} */
  let { open = $bindable(false), dirPath, takenNames } = $props();
</script>

<SubfolderNameDialog
  bind:open
  title={_('new_folder')}
  okLabel={_('new_folder_create')}
  description={_('new_folder_description', { values: { folder: `/${dirPath}` } })}
  {takenNames}
  onSubmit={(name) => {
    runAssetCommit(() => createSubfolder(createPath([dirPath, name])), {
      progress: 'creating_folder',
      failure: 'creating_folder_failed',
    });
  }}
/>
