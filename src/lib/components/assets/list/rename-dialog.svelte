<!--
  @component
  Rename Asset dialog, shared by repository assets and assets on external locations. It validates
  the new name against the sibling names, narrows the initial selection to the name without the
  extension, and asks for confirmation when the extension changes. The caller performs the actual
  rename.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Dialog, TextInput } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';

  import FileExtensionChangeDialog from '$lib/components/assets/shared/file-extension-change-dialog.svelte';
  import { showAssetOverlay } from '$lib/services/assets/view';
  import { isEquivalentFileExtension } from '$lib/services/utils/file';

  /**
   * @typedef {object} Props
   * @property {boolean} open Whether the dialog is open.
   * @property {string} name Current file name.
   * @property {string[]} otherNames Names of the other files in the same folder, which the new name
   * must not duplicate.
   * @property {number} [usedEntryCount] Number of entries using the asset, mentioned in the dialog
   * body because they will be updated as well.
   * @property {(newName: string) => void} onRename Called with the new name once confirmed.
   * @property {() => void} [onClose] Called when the dialog is closed for good, as opposed to
   * while the extension change confirmation is shown.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    open = $bindable(false),
    name,
    otherNames,
    usedEntryCount = 0,
    onRename,
    onClose = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const componentId = $props.id();

  let confirmationOpen = $state(false);
  /** @type {HTMLInputElement | undefined} */
  let inputElement = $state();
  /** Whether the file name has been auto-selected in the input field. */
  let nameSelected = false;
  let newName = $state('');

  const { extension: oldExtension } = $derived(getPathInfo(name));
  const trimmedName = $derived(newName.trim());
  const newExtension = $derived(getPathInfo(trimmedName).extension);
  /** Whether the file extension is being changed in a way that requires confirmation. */
  const extensionChanged = $derived(!isEquivalentFileExtension(oldExtension, newExtension));

  const error = $derived.by(() => {
    if (!trimmedName) return 'empty';
    if (trimmedName.includes('/')) return 'character';
    if (otherNames.includes(trimmedName)) return 'duplicate';
    return undefined;
  });

  const invalid = $derived(!!error);

  /**
   * Narrow down the selection in the input field to the file name, excluding the extension, just
   * like the macOS Finder and Windows File Explorer do. The Dialog component selects the entire
   * value once the dialog is open, so this is called in response to that initial selection.
   */
  const selectFileName = () => {
    if (nameSelected || !inputElement) {
      return;
    }

    nameSelected = true;

    const { filename } = getPathInfo(inputElement.value);

    inputElement.setSelectionRange(0, filename.length);
  };

  // Reset the input whenever the dialog is opened
  $effect(() => {
    if (open) {
      newName = name;
      nameSelected = false;
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

<Dialog
  title={_('rename_x', { values: { name } })}
  bind:open
  okLabel={_('rename')}
  okDisabled={trimmedName === name || invalid}
  onOk={() => {
    if (extensionChanged) {
      // Ask for confirmation before renaming
      confirmationOpen = true;
    } else {
      onRename(trimmedName);
    }
  }}
  onClose={() => {
    if (!confirmationOpen) {
      onClose?.();
    }
  }}
>
  <p>
    {_('enter_new_name_for_asset', { values: { count: usedEntryCount } })}
  </p>
  <div role="none">
    <TextInput
      dir="auto"
      bind:value={newName}
      bind:element={inputElement}
      flex
      {invalid}
      aria-errormessage="{componentId}-error"
      onselect={() => {
        selectFileName();
      }}
    />
  </div>
  <div role="none" class="error" id="{componentId}-error">
    {#if invalid}
      {_(`enter_new_name_for_asset_error.${error}`)}
    {/if}
  </div>
</Dialog>

<FileExtensionChangeDialog
  bind:open={confirmationOpen}
  {oldExtension}
  {newExtension}
  okLabel={_('rename')}
  onOk={() => {
    onRename(trimmedName);
    onClose?.();
  }}
  onCancel={() => {
    // Go back to the rename dialog, keeping the entered name
    open = true;
  }}
/>

<style>
  p {
    margin: 0 0 8px;
  }

  div {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .error {
    margin: 0;
    color: var(--sui-error-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
