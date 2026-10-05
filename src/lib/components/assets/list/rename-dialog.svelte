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
  import { tick } from 'svelte';

  import FileExtensionChangeDialog from '$lib/components/assets/shared/file-extension-change-dialog.svelte';
  import { formatFileName } from '$lib/services/assets/file-name';
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
    /* eslint-disable prefer-const */
    open = $bindable(false),
    name,
    otherNames,
    usedEntryCount = 0,
    blockedMessage = undefined,
    slugificationEnabled = false,
    onRename,
    onClose = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const componentId = $props.id();

  let confirmationOpen = $state(false);
  /** @type {HTMLInputElement | undefined} */
  let inputElement = $state();
  /** Whether to keep the entered name when the dialog is reopened from the confirmation dialog. */
  let keepName = false;
  let newName = $state('');

  const { extension: oldExtension } = $derived(getPathInfo(name));
  const trimmedName = $derived(newName.trim());
  /** Name the file will be renamed to, which may be different from the entered name. */
  const finalName = $derived(
    slugificationEnabled && trimmedName
      ? formatFileName(trimmedName, { slugificationEnabled })
      : trimmedName,
  );
  const newExtension = $derived(getPathInfo(finalName).extension);
  /** Whether the file extension is being changed in a way that requires confirmation. */
  const extensionChanged = $derived(!isEquivalentFileExtension(oldExtension, newExtension));

  const error = $derived.by(() => {
    if (!trimmedName) return 'empty';
    if (trimmedName.includes('/')) return 'character';
    if (otherNames.includes(finalName)) return 'duplicate';
    return undefined;
  });

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

<Dialog
  title={_('rename_x', { values: { name } })}
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
>
  {#if blockedMessage}
    <p role="alert">{blockedMessage}</p>
  {:else}
    <p>
      {_('enter_new_name_for_asset', { values: { count: usedEntryCount } })}
    </p>
  {/if}
  <div role="none">
    <TextInput
      dir="auto"
      bind:value={newName}
      bind:element={inputElement}
      flex
      disabled={!!blockedMessage}
      {invalid}
      aria-errormessage="{componentId}-error"
    />
  </div>
  {#if !invalid && finalName !== trimmedName}
    <div role="status" class="note">
      {_('file_will_be_saved_as', { values: { name: finalName } })}
    </div>
  {/if}
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
    onRename(finalName);
    onClose?.();
  }}
  onCancel={() => {
    // Go back to the rename dialog, keeping the entered name
    keepName = true;
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

  .note {
    margin: 4px 0 0;
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
  }

  .error {
    margin: 0;
    color: var(--sui-error-foreground-color);
    font-size: var(--sui-font-size-small);
  }
</style>
