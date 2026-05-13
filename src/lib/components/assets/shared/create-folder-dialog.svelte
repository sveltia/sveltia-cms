<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog, TextInput } from '@sveltia/ui';

  import { createFolder } from '$lib/services/assets/data/create';

  /**
   * @import { AssetFolderInfo } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {AssetFolderInfo | undefined} parentFolder Parent folder info.
   * @property {string} [currentSubPath] Current sub-path within the parent folder.
   * @property {() => void} onClose Close handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    parentFolder,
    currentSubPath = '',
    onClose,
    /* eslint-enable prefer-const */
  } = $props();

  let folderName = $state('');
  let errorMessage = $state('');

  /**
   * Trim whitespace from a folder name.
   * @param {string} str Input string.
   * @returns {string} Trimmed folder name.
   */
  const trimFolderName = (str) => str.trim();

  /**
   * Validate the folder name.
   * @returns {boolean} Whether the name is valid.
   */
  const isValid = () => {
    if (!folderName.trim()) {
      errorMessage = _('assets_dialog.folder_name_empty');

      return false;
    }

    // eslint-disable-next-line no-control-regex
    if (/[<>:"/\\|?*\x00-\x1f]/.test(folderName)) {
      errorMessage = _('assets_dialog.folder_name_character');

      return false;
    }

    errorMessage = '';

    return true;
  };

  /**
   * Handle the Create button click.
   */
  const onCreate = async () => {
    if (!isValid()) {
      return;
    }

    try {
      await createFolder(trimFolderName(folderName), parentFolder, currentSubPath);
    } catch (e) {
      errorMessage = /** @type {Error} */ (e).message;

      return;
    }

    folderName = '';
    open = false;
    onClose();
  };

  /**
   * Handle the dialog close.
   */
  const handleClose = () => {
    folderName = '';
    errorMessage = '';
    open = false;
    onClose();
  };
</script>

<Dialog
  title={_('assets_dialog.create_folder')}
  size="small"
  okLabel={_('create')}
  cancelLabel={_('cancel')}
  bind:open
  onOk={onCreate}
  onClose={handleClose}
>
  <TextInput
    dir="auto"
    flex
    bind:value={folderName}
    placeholder={_('assets_dialog.enter_folder_name')}
    aria-label={_('assets_dialog.enter_folder_name')}
    autofocus
    oninput={() => {
      if (errorMessage) {
        errorMessage = '';
      }
    }}
    onkeydown={(event) => {
      if (event.key === 'Enter') {
        onCreate();
      }
    }}
  />
  {#if errorMessage}
    <div role="alert" class="error">{errorMessage}</div>
  {/if}
</Dialog>

<style lang="scss">
  .error {
    margin-top: 8px;
    color: var(--sui-error-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
