<!--
  @component
  New Folder dialog, shared by the Asset Library and the asset picker. It creates a subfolder in the
  given directory and reports the progress and the result, but leaves the user where they are: the
  new folder is listed along with the others, ready to be opened.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';

  import SubfolderNameDialog from '$lib/components/assets/list/subfolder-name-dialog.svelte';
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
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    dirPath,
    takenNames,
    /* eslint-enable prefer-const */
  } = $props();

  // Committing to a remote repository takes a few seconds, and the dialog is gone by then, so the
  // folder would otherwise be created with nothing on screen to say it’s under way
  let creating = $state(false);
  let creationFailed = $state(false);

  /**
   * Create the folder.
   * @param {string} name Folder name.
   */
  const create = async (name) => {
    creating = true;

    try {
      await createSubfolder(createPath([dirPath, name]));
    } catch (/** @type {any} */ ex) {
      creationFailed = true;
      // eslint-disable-next-line no-console
      console.error(ex);
    } finally {
      creating = false;
    }
  };
</script>

<SubfolderNameDialog
  bind:open
  title={_('new_folder')}
  okLabel={_('new_folder_create')}
  description={_('new_folder_description', { values: { folder: `/${dirPath}` } })}
  {takenNames}
  onSubmit={(name) => {
    create(name);
  }}
/>

<!-- `duration={0}` keeps this up until the commit settles, however long it takes -->
<Toast show={creating} duration={0}>
  <Alert status="info">{_('creating_folder')}</Alert>
</Toast>

<Toast bind:show={creationFailed}>
  <Alert status="error">{_('creating_folder_failed')}</Alert>
</Toast>
