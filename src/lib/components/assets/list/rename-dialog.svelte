<!--
  @component
  Rename Asset dialog, shared by repository assets and assets on external locations. It validates
  the new name against the sibling names, narrows the initial selection to the name without the
  extension, and asks for confirmation when the extension changes. The caller performs the actual
  rename.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { getPathInfo } from '@sveltia/utils/file';
  import { tick } from 'svelte';

  import NameInputDialog from '$lib/components/assets/list/name-input-dialog.svelte';
  import FileExtensionChangeDialog from '$lib/components/assets/shared/file-extension-change-dialog.svelte';
  import { formatFileName, validateAssetName } from '$lib/services/assets/file-name';
  import { showAssetOverlay } from '$lib/services/assets/view';
  import { isEquivalentFileExtension } from '$lib/services/utils/file';

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {string} name Current file name.
   * @property {string[]} otherNames Names of the other files in the same folder, which the new name
   * must not duplicate.
   * @property {string[]} [folderNames] Names of the subfolders in the same folder, which the new
   * name must not duplicate either.
   * @property {string[]} [fileNames] Names of the files in the same folder that aren’t assets, like
   * entry files, which the new name must not duplicate either.
   * @property {number} [usedEntryCount] Number of entries using the asset, mentioned in the dialog
   * body because they will be updated as well.
   * @property {string} [warning] Warning shown below the dialog body, e.g. that entries linking to
   * the asset will break, as they can’t be updated. The asset can still be renamed.
   * @property {string} [blockedMessage] Why the asset can’t be renamed, e.g. because a read-only
   * entry uses it. The message is shown in place of the input, and the Rename button is disabled.
   * @property {boolean} [slugificationEnabled] Whether the new name is slugified, according to the
   * `slugify_filename` media library option, as an uploaded file’s name is. The resulting name is
   * shown below the input when it differs from the entered one.
   * @property {(newName: string) => void} onRename Called with the new name once confirmed.
   * @property {() => void} [onClose] Called when the dialog is closed for good, as opposed to
   * while the extension change confirmation is shown.
   */

  /** @type {Props} */
  let {
    open = $bindable(false),
    name,
    otherNames,
    folderNames = [],
    fileNames = [],
    usedEntryCount = 0,
    warning = undefined,
    blockedMessage = undefined,
    slugificationEnabled = false,
    onRename,
    onClose = undefined,
  } = $props();

  const title = $derived(_('rename_x', { values: { name } }));

  let confirmationOpen = $state(false);
  /** @type {HTMLInputElement | undefined} */
  let inputElement = $state();
  /** Whether to keep the entered name when the dialog is reopened from the confirmation dialog. */
  let keepName = false;
  let newName = $state('');

  const { extension: oldExtension } = $derived(getPathInfo(name));
  const trimmedName = $derived(newName.trim());
  /**
   * Name the file will be renamed to, which may be different from the entered name: sanitized like
   * an uploaded file’s name, and slugified if enabled.
   */
  const finalName = $derived(
    trimmedName ? formatFileName(trimmedName, { slugificationEnabled }) : '',
  );
  const newExtension = $derived(getPathInfo(finalName).extension);
  /** Whether the file extension is being changed in a way that requires confirmation. */
  const extensionChanged = $derived(!isEquivalentFileExtension(oldExtension, newExtension));

  const error = $derived(
    validateAssetName({
      name: trimmedName,
      fileName: finalName,
      otherNames,
      folderNames,
      fileNames,
    }),
  );

  const invalid = $derived(!!error);

  /**
   * Focus the input field, and select the file name, excluding the extension, just like the macOS
   * Finder and Windows File Explorer do. This is done once, as soon as the dialog is shown, rather
   * than in response to a `select` event, which arrives later: the selection would then be narrowed
   * after the user had already selected the whole name and started typing over it.
   */
  const selectFileName = async () => {
    // Wait for the dialog to become interactive
    await tick();

    /* v8 ignore next 3 -- the input is rendered along with the dialog */
    if (!inputElement) {
      return;
    }

    inputElement.focus();
    inputElement.setSelectionRange(0, getPathInfo(inputElement.value).filename.length);
  };

  // Reset the input whenever the dialog is opened, unless we’re coming back from the confirmation
  $effect(() => {
    if (open) {
      if (!keepName) {
        newName = name;
      }

      keepName = false;
    }
  });

  // Close the dialog along with the asset details overlay
  $effect(() => {
    if (!showAssetOverlay.current) {
      open = false;
      confirmationOpen = false;
      onClose?.();
    }
  });
</script>

<NameInputDialog
  {title}
  bind:open
  okLabel={_('rename')}
  okDisabled={!!blockedMessage || finalName === name || invalid}
  onOk={() => {
    if (extensionChanged) {
      // Ask for confirmation before renaming
      confirmationOpen = true;
    } else {
      onRename(finalName);
    }
  }}
  onClose={() => {
    if (!confirmationOpen) {
      onClose?.();
    }
  }}
  onOpen={() => {
    selectFileName();
  }}
  description={_('enter_new_name_for_asset', { values: { count: usedEntryCount } })}
  {warning}
  {blockedMessage}
  bind:value={newName}
  bind:element={inputElement}
  ariaLabel={title}
  note={!invalid && finalName !== trimmedName
    ? _('file_will_be_saved_as', { values: { name: finalName } })
    : undefined}
  error={invalid ? _(`enter_new_name_for_asset_error.${error}`) : undefined}
/>

<FileExtensionChangeDialog
  bind:open={confirmationOpen}
  {oldExtension}
  {newExtension}
  okLabel={_('rename')}
  onOk={() => {
    onRename(finalName);
    onClose?.();
  }}
  onCancel={() => {
    // Go back to the rename dialog, keeping the entered name
    keepName = true;
    open = true;
  }}
/>
